/* =========================================================
 * api.js —— 音乐接口封装层
 * 由于浏览器同源策略限制，本地 HTML 直接请求第三方接口
 * 通常会被 CORS 拦截。这里统一走「JSONP / 代理」两种方式：
 *   1) 优先尝试直连 fetch（部分接口允许跨域）
 *   2) 失败时自动回退到公共 CORS 代理
 * 你只需在下方 CONFIG 里维护接口地址即可。
 * ========================================================= */

const CONFIG = {
  // 搜索接口：使用自带 CORS 的公开音乐聚合 API，静态站点可直连，无需代理
  search: {
    // 网易云 + 酷狗 聚合搜索（返回 { data: [...] }），源用 source 区分
    wy: 'https://api.vkeys.cn/v2/music/netease',
    kg: 'https://api.vkeys.cn/v2/music/kugou'
  },

  // 解析（拿播放地址 / 歌词 / 封面）
  resolve: {
    wy: 'https://api.vkeys.cn/v2/music/netease',
    kg: 'https://api.vkeys.cn/v2/music/kugou'
  },

  // 音质档位
  level: {
    wy: 'exhigh',   // standard / higher / exhigh / lossless
    kg: 'standard'  // standard / high / flac
  },

  // 该 API 自带 CORS，直连即可；如某天失效可在此追加备用地址
  proxies: [
    (u) => u // 直连
  ]
};

/* ---------- 通用请求：依次尝试直连与各代理 ---------- */
const REQ_TIMEOUT = 12000;   // 单个通道超时（毫秒）

async function smartFetch(url, asJson = true) {
  const errors = [];
  for (let i = 0; i < CONFIG.proxies.length; i++) {
    const wrap = CONFIG.proxies[i];
    const target = wrap(url);
    const channel = i === 0 ? '直连' : `代理${i}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT);
    try {
      const res = await fetch(target, { signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      if (!asJson) { clearTimeout(timer); return text; }
      // 有些代理会包裹一层，这里做兼容
      let data;
      try { data = JSON.parse(text); }
      catch {
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('返回不是 JSON');
        data = JSON.parse(m[0]);
      }
      clearTimeout(timer);
      return data;
    } catch (e) {
      // 归一化：把 AbortError 转成更易懂的超时提示
      const msg = (e && e.name === 'AbortError')
        ? `超时（${REQ_TIMEOUT / 1000}s）`
        : (e && e.message ? e.message : String(e));
      errors.push(`${channel}: ${msg}`);
      console.warn('[smartFetch] 通道失败：', target, msg);
    } finally {
      clearTimeout(timer);
    }
  }
  const err = new Error('所有通道均不可用（' + errors.join('；') + '）');
  err.details = errors;
  throw err;
}

/* ---------- 搜索（支持分页） ---------- */
const PAGE_SIZE = 30;

async function searchMusic(source, keyword, page = 1) {
  const kw = encodeURIComponent(keyword.trim());
  const base = source === 'wy' ? CONFIG.search.wy : CONFIG.search.kg;
  // vkeys 搜索：?word=关键词&page=页码&num=每页数量
  const url = `${base}?word=${kw}&page=${page}&num=${PAGE_SIZE}`;

  const res = await smartFetch(url);
  return normalizeSearch(source, res);
}

/* ---------- 把不同源的搜索结果统一成同一种结构 ---------- */
function normalizeSearch(source, res) {
  const list = [];

  // vkeys 聚合返回：{ code, message, data: [ { id, song, singer, album, time, quality, cover } ] }
  const vkSongs = Array.isArray(res?.data) ? res.data : null;
  if (vkSongs) {
    vkSongs.forEach((s) => {
      list.push({
        source,
        id: String(s.id ?? ''),
        name: s.song ?? s.name ?? '未知歌曲',
        artist: s.singer ?? s.artist ?? '未知歌手',
        album: s.album ?? '',
        pic: s.cover ?? s.pic ?? '',
        duration: 0   // 该接口不返回时长
      });
    });
    return list;
  }

  // 网易云常见返回：{ code, data: { songs: [...] } } 或 { result: { songs: [...] } }
  const wySongs =
    res?.data?.songs || res?.result?.songs || res?.songs ||
    (Array.isArray(res?.data) ? res.data : null);

  if (source === 'wy' && wySongs) {
    wySongs.forEach((s) => {
      // 封面：优先 picUrl；album.picId 是数字 ID 需加密才能拼图床，故不直接拼接，留空由前端占位图兜底
      let pic = s.picUrl ?? s.al?.picUrl ?? s.album?.picUrl ?? '';
      list.push({
        source: 'wy',
        id: String(s.id ?? s.songId ?? ''),
        name: s.name ?? s.songname ?? '未知歌曲',
        artist: pickArtists(s),
        album: s.album?.name ?? s.albumname ?? s.al?.name ?? '',
        pic,
        duration: s.dt ?? s.duration ?? 0
      });
    });
    return list;
  }

  // 酷狗官方接口返回：{ status, data: { info: [...] } }
  const kgSongs =
    res?.data?.info || res?.data?.lists || res?.data?.list || res?.lists ||
    (Array.isArray(res?.data) ? res.data : null);

  if (source === 'kg' && kgSongs) {
    kgSongs.forEach((s) => {
      // 官方接口封面是模板：http://imge.kugou.com/stdmusic/{size}/xxx.jpg
      let pic = s.img ?? s.pic ?? s.album_img ?? '';
      const cover = s.trans_param?.union_cover;
      if (!pic && cover) pic = cover.replace('{size}', '400');
      list.push({
        source: 'kg',
        id: String(s.hash ?? s.HASH ?? s.rid ?? ''),
        name: s.songname ?? s.name ?? s.filename ?? '未知歌曲',
        artist: s.singername ?? s.singer ?? s.author ?? '未知歌手',
        album: s.album_name ?? s.album ?? '',
        pic,
        duration: s.duration ?? s.timelen ?? 0
      });
    });
    return list;
  }

  // 兜底：如果接口直接返回数组
  const arr = Array.isArray(res) ? res : (res?.data ? [res.data] : []);
  arr.forEach((s) => {
    list.push({
      source,
      id: String(s.id ?? s.hash ?? s.rid ?? ''),
      name: s.name ?? s.songname ?? '未知歌曲',
      artist: s.artist ?? s.singername ?? s.singer ?? '未知歌手',
      album: s.album ?? '',
      pic: s.pic ?? s.img ?? '',
      duration: s.duration ?? 0
    });
  });
  return list;
}

function pickArtists(s) {
  if (Array.isArray(s.ar)) return s.ar.map((a) => a.name).join(' & ');
  if (Array.isArray(s.artists)) return s.artists.map((a) => a.name).join(' & ');
  return s.artist ?? s.singer ?? '未知歌手';
}

/* ---------- 解析单曲（拿播放地址、歌词、封面） ---------- */
async function resolveMusic(source, id) {
  let url;
  if (source === 'wy') {
    url = `${CONFIG.resolve.wy}?id=${encodeURIComponent(id)}&type=json&level=${CONFIG.level.wy}`;
  } else {
    url = `${CONFIG.resolve.kg}?id=${encodeURIComponent(id)}&level=${CONFIG.level.kg}`;
  }

  const res = await smartFetch(url);
  const d = res?.data ?? res;
  if (!d) throw new Error('解析失败：无数据');

  return {
    source,
    id: String(d.rid ?? d.hash ?? id),
    name: d.name ?? '未知歌曲',
    artist: d.artist ?? '未知歌手',
    album: d.album ?? '',
    pic: d.pic ?? '',
    lrc: cleanLrc(d.lrc ?? d.lyric ?? ''),
    quality: d.quality ?? '',
    size: d.size ?? '',
    url: d.url ?? d.src ?? ''
  };
}

/* ---------- 歌词清洗：去掉 BOM / 多余空行 ---------- */
function cleanLrc(raw) {
  if (!raw) return '';
  return raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
}

/* ---------- 导出 ---------- */
window.MusicAPI = { searchMusic, resolveMusic, CONFIG };
