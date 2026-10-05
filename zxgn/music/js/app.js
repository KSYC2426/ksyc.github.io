/* =========================================================
 * app.js —— 页面主逻辑
 * 搜索 / 播放 / 收藏 / 下载 / 歌词 全部逻辑
 * 依赖 api.js 暴露的 window.MusicAPI
 * ========================================================= */

const API = window.MusicAPI;
const apiSearch = API.searchMusic;
const apiResolve = API.resolveMusic;

/* ---------- 收藏歌单常量（须在 state 之前声明） ---------- */
const FAV_KEY = 'ht_music_fav_v2';   // 新版：{ playlists:[{id,name,songs:[]}], cur: playListId }
const DEFAULT_PL = 'like';           // 默认「喜欢」歌单 id

/* ---------- 全局状态 ---------- */
const state = {
  source: 'wy',        // 当前搜索源
  keyword: '',
  results: [],         // 当前搜索结果
  list: [],            // 当前播放队列（搜索结果或收藏）
  index: -1,           // 当前播放索引
  playing: false,
  mode: 'loop',        // loop / single / shuffle
  favStore: loadFavStore(), // 收藏歌单集合 { playlists, cur }
  lyrics: [],          // 解析后的歌词 [{time, text}]
  lyricIndex: -1,
  curSong: null,       // 当前解析后的歌曲对象
  page: 1,             // 当前搜索页码
  hasMore: true,       // 是否还有下一页
  loadingMore: false   // 是否正在加载下一页
};

/* ---------- DOM 缓存 ---------- */
const $ = (id) => document.getElementById(id);
const el = {
  searchInput: $('searchInput'),
  btnSearch: $('btnSearch'),
  btnNavSearch: $('btnNavSearch'),
  btnNavFav: $('btnNavFav'),
  searchSub: $('searchSub'),
  searchResult: $('searchResult'),
  favResult: $('favResult'),
  favSub: $('favSub'),
  favTabs: $('favTabs'),
  btnNewFav: $('btnNewFav'),
  viewSearch: $('viewSearch'),
  viewFav: $('viewFav'),

  audio: $('audio'),
  plCover: $('plCover'),
  plCoverImg: $('plCoverImg'),
  plName: $('plName'),
  plArtist: $('plArtist'),
  btnPlay: $('btnPlay'),
  btnPrev: $('btnPrev'),
  btnNext: $('btnNext'),
  btnLoop: $('btnLoop'),
  btnShuffle: $('btnShuffle'),
  btnFavCur: $('btnFavCur'),
  btnLyric: $('btnLyric'),
  curTime: $('curTime'),
  totalTime: $('totalTime'),
  progressTrack: $('progressTrack'),
  progressFill: $('progressFill'),
  volumeTrack: $('volumeTrack'),
  volumeFill: $('volumeFill'),
  btnMute: $('btnMute'),

  lyricPanel: $('lyricPanel'),
  lyricBody: $('lyricBody'),
  lyricSong: $('lyricSong'),
  btnCloseLyric: $('btnCloseLyric'),

  toastBox: $('toastBox'),

  modalMask: $('modalMask'),
  modalTitle: $('modalTitle'),
  modalDesc: $('modalDesc'),
  modalInput: $('modalInput'),
  modalOk: $('modalOk'),
  modalCancel: $('modalCancel')
};

/* =========================================================
 * 工具函数
 * ========================================================= */

/* 自定义弹窗：替代原生 prompt / confirm（部分环境不支持） */
function showModal({ title, desc = '', input = null, okText = '确定' }) {
  return new Promise((resolve) => {
    el.modalTitle.textContent = title;
    el.modalDesc.textContent = desc;
    el.modalDesc.hidden = !desc;
    if (input === null) {
      el.modalInput.hidden = true;
      el.modalInput.value = '';
    } else {
      el.modalInput.hidden = false;
      el.modalInput.value = input;
    }
    el.modalOk.textContent = okText;
    el.modalMask.hidden = false;
    setTimeout(() => { if (input !== null) el.modalInput.focus(); el.modalInput.select?.(); }, 30);

    const cleanup = () => {
      el.modalMask.hidden = true;
      el.modalOk.onclick = null;
      el.modalCancel.onclick = null;
      el.modalInput.onkeydown = null;
      el.modalMask.onclick = null;
    };
    const done = (val) => { cleanup(); resolve(val); };

    el.modalOk.onclick = () => done(input === null ? true : el.modalInput.value.trim());
    el.modalCancel.onclick = () => done(null);
    el.modalMask.onclick = (e) => { if (e.target === el.modalMask) done(null); };
    el.modalInput.onkeydown = (e) => {
      if (e.key === 'Enter') done(el.modalInput.value.trim());
      if (e.key === 'Escape') done(null);
    };
  });
}
function showPrompt(title, defaultValue = '') {
  return showModal({ title, input: defaultValue });
}
function showConfirm(title, desc = '') {
  return showModal({ title, desc, okText: '删除' });
}

/* 中间弹窗：选择要添加到的歌单（返回歌单 id 或 null） */
function pickPlaylist(song) {
  return new Promise((resolve) => {
    const mask = $('plPickMask');
    const list = $('plPickList');
    const search = $('plPickSearch');
    const desc = $('plPickDesc');
    const searchWrap = $('plPickSearchWrap');
    desc.textContent = song ? `将「${song.name} - ${song.artist}」添加到：` : '';
    search.value = '';
    searchWrap.hidden = state.favStore.playlists.length <= 6;

    const renderItems = () => {
      const kw = search.value.trim().toLowerCase();
      const cur = state.favStore.cur;
      const items = state.favStore.playlists.filter(
        (p) => !kw || p.name.toLowerCase().includes(kw)
      );
      if (!items.length) {
        list.innerHTML = `<div class="pl-pick-empty">没有匹配的歌单</div>`;
        return;
      }
      list.innerHTML = items.map((p) => `
        <button class="pl-pick-item" data-pick="${p.id}">
          <span class="pl-pick-name"><span>${esc(p.name)}</span>${p.id === cur ? '<span class="pl-pick-cur">当前</span>' : ''}</span>
          <span class="pl-pick-cnt">${p.songs.length} 首</span>
        </button>`).join('');
    };
    renderItems();
    mask.hidden = false;
    setTimeout(() => { if (!searchWrap.hidden) search.focus(); }, 40);

    const cleanup = () => {
      mask.hidden = true;
      list.onclick = null;
      search.oninput = null;
      search.onkeydown = null;
      $('plPickCancel').onclick = null;
      mask.onclick = null;
    };
    const done = (val) => { cleanup(); resolve(val); };

    list.onclick = (e) => {
      const b = e.target.closest('[data-pick]');
      if (b) done(b.dataset.pick);
    };
    search.oninput = renderItems;
    search.onkeydown = (e) => { if (e.key === 'Escape') done(null); };
    $('plPickCancel').onclick = () => done(null);
    mask.onclick = (e) => { if (e.target === mask) done(null); };
  });
}

function toast(msg, type = '') {
  const d = document.createElement('div');
  d.className = 'toast ' + type;
  d.textContent = msg;
  el.toastBox.appendChild(d);
  setTimeout(() => {
    d.style.opacity = '0';
    d.style.transform = 'translateX(30px)';
    d.style.transition = '0.25s';
    setTimeout(() => d.remove(), 260);
  }, 2200);
}

function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '00:00';
  sec = Math.floor(sec);
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const FALLBACK_COVER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' fill='%23272b3d'/%3E%3Ctext x='50%25' y='54%25' font-size='44' text-anchor='middle' fill='%236f7694'%3E%E2%99%AA%3C/text%3E%3C/svg%3E";

/* ---------- 收藏（多歌单）持久化 ---------- */
/* 兼容旧数据：旧版是纯歌曲数组，迁移进「喜欢」歌单 */
function loadFavStore() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.playlists) && parsed.playlists.length) {
        if (!parsed.playlists.some((p) => p.id === DEFAULT_PL)) {
          parsed.playlists.unshift({ id: DEFAULT_PL, name: '喜欢', songs: [] });
        }
        if (!parsed.cur) parsed.cur = DEFAULT_PL;
        return parsed;
      }
    }
    // 尝试迁移旧版
    const legacy = JSON.parse(localStorage.getItem('ht_music_fav') || '[]');
    return {
      playlists: [{ id: DEFAULT_PL, name: '喜欢', songs: Array.isArray(legacy) ? legacy : [] }],
      cur: DEFAULT_PL
    };
  } catch {
    return { playlists: [{ id: DEFAULT_PL, name: '喜欢', songs: [] }], cur: DEFAULT_PL };
  }
}
function saveFavStore() {
  localStorage.setItem(FAV_KEY, JSON.stringify(state.favStore));
}
function curPlaylist() {
  const s = state.favStore;
  return s.playlists.find((p) => p.id === s.cur) || s.playlists[0];
}
/* 当前歌单的歌曲数组（供播放队列复用） */
function curFavSongs() {
  return curPlaylist()?.songs || [];
}
function isFav(song) {
  return curFavSongs().some((f) => f.source === song.source && f.id === song.id);
}
/* 收藏 / 取消收藏（作用于当前歌单） */
function toggleFav(song) {
  if (!song || !song.id) return;
  const pl = curPlaylist();
  if (!pl) return;
  const i = pl.songs.findIndex((f) => f.source === song.source && f.id === song.id);
  if (i >= 0) {
    pl.songs.splice(i, 1);
    toast('已取消收藏', '');
  } else {
    pl.songs.unshift({
      source: song.source, id: song.id, name: song.name,
      artist: song.artist, album: song.album, pic: song.pic
    });
    toast(`已收藏到「${pl.name}」❤`, 'ok');
  }
  saveFavStore();
  renderFav();
  refreshFavButtons();
}

/* 直接添加到指定歌单（不影响当前收藏按钮） */
function addToPlaylist(song, targetId) {
  if (!song || !song.id) return;
  const to = state.favStore.playlists.find((p) => p.id === targetId);
  if (!to) return;
  const exist = to.songs.some((f) => f.source === song.source && f.id === song.id);
  if (exist) {
    toast(`「${to.name}」中已有这首歌`, '');
    return;
  }
  to.songs.unshift({
    source: song.source, id: song.id, name: song.name,
    artist: song.artist, album: song.album, pic: song.pic
  });
  saveFavStore();
  renderFav();
  refreshFavButtons();
  toast(`已添加到「${to.name}」`, 'ok');
}

/* ---------- 歌单管理 ---------- */
/* 生成不重复的歌单名：重名时自动加 (2)(3)… */
function uniquePlaylistName(base, excludeId = null) {
  const s = state.favStore;
  let name = (base || '').trim() || '新歌单';
  const exists = (n) => s.playlists.some((p) => p.id !== excludeId && p.name === n);
  if (!exists(name)) return name;
  let n = 2;
  while (exists(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}
function newPlaylist(name) {
  const s = state.favStore;
  const id = 'pl_' + Date.now();
  const finalName = uniquePlaylistName(name);
  s.playlists.push({ id, name: finalName, songs: [] });
  s.cur = id;
  saveFavStore();
  renderFav();
  renderSongList();
  if (finalName !== (name || '').trim()) toast(`已重名，自动命名为「${finalName}」`, '');
}
function renamePlaylist(id, name) {
  const p = state.favStore.playlists.find((x) => x.id === id);
  if (!p) return;
  const raw = (name || '').trim();
  if (!raw) return;
  const finalName = uniquePlaylistName(raw, id);
  if (finalName === p.name) return;
  p.name = finalName;
  saveFavStore();
  renderFav();
  renderSongList();
  toast(finalName === raw ? '已重命名' : `已重名，自动命名为「${finalName}」`, 'ok');
}
async function deletePlaylist(id) {
  if (id === DEFAULT_PL) { toast('「喜欢」歌单不可删除', 'err'); return; }
  const s = state.favStore;
  const i = s.playlists.findIndex((x) => x.id === id);
  if (i < 0) return;
  const ok = await showConfirm(
    `删除歌单「${s.playlists[i].name}」？`,
    `其中的 ${s.playlists[i].songs.length} 首歌也会一并删除，此操作不可恢复。`
  );
  if (!ok) return;
  s.playlists.splice(i, 1);
  if (s.cur === id) s.cur = DEFAULT_PL;
  saveFavStore();
  renderFav();
  renderSongList();
  toast('已删除歌单', '');
}
function switchPlaylist(id) {
  state.favStore.cur = id;
  saveFavStore();
  renderFav();
}
/* 把歌曲移动到另一个歌单 */
function moveSongTo(songIdx, targetId) {
  const s = state.favStore;
  const from = curPlaylist();
  const to = s.playlists.find((p) => p.id === targetId);
  if (!from || !to || from.id === to.id) return;
  const [song] = from.songs.splice(songIdx, 1);
  if (song) to.songs.unshift(song);
  saveFavStore();
  renderFav();
  toast(`已移动到「${to.name}」`, 'ok');
}

/* =========================================================
 * 视图切换
 * ========================================================= */
function switchView(view) {
  el.viewSearch.classList.toggle('active', view === 'search');
  el.viewFav.classList.toggle('active', view === 'fav');
  el.btnNavSearch.classList.toggle('active', view === 'search');
  el.btnNavFav.classList.toggle('active', view === 'fav');
  if (view === 'fav') renderFav();
}

/* =========================================================
 * 搜索
 * ========================================================= */
async function doSearch() {
  const kw = el.searchInput.value.trim();
  if (!kw) { toast('请输入搜索关键词', 'err'); return; }
  state.keyword = kw;
  state.page = 1;
  state.hasMore = true;
  state.loadingMore = false;

  el.searchResult.innerHTML = `<div class="state"><div class="spinner"></div><div>正在搜索「${esc(kw)}」…</div></div>`;
  el.searchSub.textContent = '搜索中…';
  switchView('search');

  try {
    const list = await apiSearch(state.source, kw, 1);
    state.results = list;
    state.list = list;
    if (!list.length) {
      el.searchResult.innerHTML = `<div class="state"><div class="big">😕</div><div>没有找到相关歌曲，换个关键词试试</div></div>`;
      el.searchSub.textContent = '无结果';
      state.hasMore = false;
      return;
    }
    state.hasMore = list.length >= 30;
    updateSearchSub();
    renderSongList();
  } catch (e) {
    console.error(e);
    el.searchResult.innerHTML = `<div class="state"><div class="big">⚠</div><div>搜索失败：${esc(e.message)}<br><small style="opacity:.7">可尝试切换音源，或检查网络 / 代理是否可用</small></div><div class="state-actions"><button class="btn-retry" id="btnSearchRetry">重试</button></div></div>`;
    el.searchSub.textContent = '搜索失败';
    state.hasMore = false;
    const retry = document.getElementById('btnSearchRetry');
    if (retry) retry.onclick = doSearch;
  }
}

function updateSearchSub() {
  el.searchSub.textContent = `共 ${state.results.length} 首 · 来源 ${state.source === 'wy' ? '网易云' : '酷狗'}`;
}

/* 加载下一页 */
async function loadMore() {
  if (state.loadingMore || !state.hasMore || !state.keyword) return;
  state.loadingMore = true;
  const footer = document.getElementById('loadMoreBar');
  if (footer) footer.textContent = '正在加载更多…';

  try {
    const next = await apiSearch(state.source, state.keyword, state.page + 1);
    if (!next.length) {
      state.hasMore = false;
      if (footer) footer.textContent = '— 已经到底啦 —';
      return;
    }
    // 去重（按 source+id）
    const seen = new Set(state.results.map((s) => s.source + ':' + s.id));
    const fresh = next.filter((s) => !seen.has(s.source + ':' + s.id));
    state.results = state.results.concat(fresh);
    state.list = state.results;
    state.page += 1;
    state.hasMore = fresh.length > 0 && next.length >= 30;
    updateSearchSub();
    renderSongList();
  } catch (e) {
    console.error(e);
    toast('加载更多失败：' + e.message, 'err');
    if (footer) footer.textContent = '加载失败，滚动重试';
  } finally {
    state.loadingMore = false;
  }
}

/* =========================================================
 * 渲染搜索结果列表
 * ========================================================= */
function renderSongList() {
  const html = state.results.map((s, i) => {
    const playing = state.curSong && state.curSong.source === s.source && state.curSong.id === s.id;
    const fav = isFav(s);
    return `
      <div class="song-item ${playing ? 'playing' : ''}" data-idx="${i}">
        <div class="song-idx">
          <img src="${esc(s.pic || FALLBACK_COVER)}" onerror="this.src='${FALLBACK_COVER}'" alt="">
          <div class="idx">${playing ? '♪' : i + 1}</div>
        </div>
        <div class="song-meta">
          <div class="song-name">${esc(s.name)}</div>
          <div class="song-info">
            <span class="tag src-${s.source}">${s.source === 'wy' ? '网易云' : '酷狗'}</span>
            <span>${esc(s.artist)}</span>
            ${s.album ? `<span class="dot"></span><span>${esc(s.album)}</span>` : ''}
          </div>
        </div>
        <div class="song-ops">
          <button class="op-btn add-btn" data-addbtn="${i}" title="添加到歌单">＋</button>
          <button class="op-btn ${fav ? 'fav-on' : ''}" data-op="fav" data-idx="${i}" title="收藏">${fav ? '❤' : '♡'}</button>
          <button class="op-btn" data-op="download" data-idx="${i}" title="下载">⬇</button>
        </div>
      </div>`;
  }).join('');
  el.searchResult.innerHTML = `<div class="song-list">${html}</div><div id="loadMoreBar" class="load-more">${state.hasMore ? '上滑加载更多…' : '— 已经到底啦 —'}</div>`;
}

/* =========================================================
 * 渲染收藏歌单（标签 + 卡片）
 * ========================================================= */
function renderFavTabs() {
  const s = state.favStore;
  el.favTabs.innerHTML = s.playlists.map((p) => {
    const active = p.id === s.cur;
    const ops = p.id === DEFAULT_PL ? '' :
      `<span class="tab-op tab-rename" data-rename="${p.id}" title="重命名">✎</span>` +
      `<span class="tab-op" data-delpl="${p.id}" title="删除歌单">✕</span>`;
    return `<div class="fav-tab ${active ? 'active' : ''}" data-pl="${p.id}">
      <span class="tab-name">${esc(p.name)}</span>
      <span class="cnt">${p.songs.length}</span>
      ${ops}
    </div>`;
  }).join('');
}

function renderFav() {
  renderFavTabs();
  const pl = curPlaylist();
  const songs = pl ? pl.songs : [];
  el.favSub.textContent = `「${pl ? pl.name : ''}」共 ${songs.length} 首`;
  if (!songs.length) {
    el.favResult.innerHTML = `<div class="state"><div class="big">💔</div><div>这个歌单还是空的<br><small style="opacity:.7">在搜索结果里点 ♡ 即可收藏到当前歌单</small></div></div>`;
    return;
  }
  const others = state.favStore.playlists.filter((p) => p.id !== pl.id);
  const html = songs.map((s, i) => {
    const moveMenu = others.length
      ? `<div class="fav-move-menu" data-menu="${i}" hidden>${others.map((p) =>
          `<button data-move="${i}" data-target="${p.id}">${esc(p.name)}</button>`).join('')}</div>`
      : '';
    return `
    <div class="fav-card" data-idx="${i}">
      <div class="fav-cover">
        <img src="${esc(s.pic || FALLBACK_COVER)}" onerror="this.src='${FALLBACK_COVER}'" alt="">
        <div class="fav-play">▶</div>
      </div>
      <button class="fav-move" data-movebtn="${i}" title="移动到其他歌单">↪</button>
      ${moveMenu}
      <button class="fav-del" data-del="${i}" title="移除">✕</button>
      <div class="fav-body">
        <div class="fav-name">${esc(s.name)}</div>
        <div class="fav-artist">${esc(s.artist)}</div>
      </div>
    </div>`;
  }).join('');
  el.favResult.innerHTML = `<div class="fav-grid">${html}</div>`;
}

/* 刷新所有收藏按钮状态 */
function refreshFavButtons() {
  renderSongList();
  const cur = state.curSong;
  if (cur) {
    const fav = isFav(cur);
    el.btnFavCur.textContent = fav ? '❤' : '♡';
    el.btnFavCur.classList.toggle('active', fav);
  }
}

/* =========================================================
 * 播放
 * ========================================================= */
async function playByIndex(idx, list) {
  const queue = list || state.list;
  const song = queue[idx];
  if (!song) return;
  state.list = queue;
  state.index = idx;

  // 立即显示基本信息（未解析前用列表里的数据）
  el.plName.textContent = song.name;
  el.plArtist.textContent = song.artist;
  el.plCoverImg.src = song.pic || FALLBACK_COVER;
  el.btnPlay.textContent = '⋯';
  toast(`正在解析：${song.name}`, '');

  try {
    const full = await apiResolve(song.source, song.id);
    if (!full.url) throw new Error('未获取到播放地址');
    state.curSong = { ...song, ...full };

    // 更新界面
    el.plName.textContent = full.name || song.name;
    el.plArtist.textContent = full.artist || song.artist;
    el.plCoverImg.src = full.pic || song.pic || FALLBACK_COVER;
    el.btnFavCur.textContent = isFav(state.curSong) ? '❤' : '♡';
    el.btnFavCur.classList.toggle('active', isFav(state.curSong));

    // 歌词
    parseLyric(full.lrc);
    el.lyricSong.textContent = `${full.name} - ${full.artist}`;

    // 播放
    el.audio.src = full.url;
    await el.audio.play();
    state.playing = true;
    el.btnPlay.textContent = '⏸';

    renderSongList();
  } catch (e) {
    console.error(e);
    el.btnPlay.textContent = '▶';
    state.playing = false;
    toast('播放失败：' + e.message, 'err');
  }
}

function togglePlay() {
  if (!el.audio.src) {
    // 没有歌曲时播放当前列表第一首
    if (state.list.length) playByIndex(0);
    else toast('请先搜索并选择歌曲', 'err');
    return;
  }
  if (el.audio.paused) {
    el.audio.play();
    state.playing = true;
    el.btnPlay.textContent = '⏸';
  } else {
    el.audio.pause();
    state.playing = false;
    el.btnPlay.textContent = '▶';
    el.plCover.classList.remove('spin');
  }
}

function playPrev() {
  if (!state.list.length) return;
  let i = state.index - 1;
  if (i < 0) i = state.list.length - 1;
  playByIndex(i);
}

function playNext() {
  if (!state.list.length) return;
  if (state.mode === 'shuffle') {
    let i = state.index;
    if (state.list.length > 1) {
      while (i === state.index) i = Math.floor(Math.random() * state.list.length);
    } else i = 0;
    playByIndex(i);
    return;
  }
  let i = state.index + 1;
  if (i >= state.list.length) i = 0;
  playByIndex(i);
}

/* =========================================================
 * 歌词
 * ========================================================= */
function parseLyric(lrc) {
  state.lyrics = [];
  state.lyricIndex = -1;
  if (!lrc) {
    el.lyricBody.innerHTML = '<div class="lyric-line">暂无歌词</div>';
    return;
  }
  const lines = lrc.split('\n');
  const reg = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  lines.forEach((line) => {
    const text = line.replace(reg, '').trim();
    let m;
    reg.lastIndex = 0;
    while ((m = reg.exec(line)) !== null) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const ms = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0;
      state.lyrics.push({ time: min * 60 + sec + ms / 1000, text });
    }
  });
  state.lyrics.sort((a, b) => a.time - b.time);
  state.lyrics = state.lyrics.filter((l) => l.text);

  el.lyricBody.innerHTML = state.lyrics.length
    ? state.lyrics.map((l, i) => `<div class="lyric-line" data-i="${i}">${esc(l.text)}</div>`).join('')
    : '<div class="lyric-line">暂无歌词</div>';
}

function syncLyric(cur) {
  if (!state.lyrics.length) return;
  let idx = -1;
  for (let i = 0; i < state.lyrics.length; i++) {
    if (cur >= state.lyrics[i].time) idx = i;
    else break;
  }
  if (idx === state.lyricIndex) return;
  state.lyricIndex = idx;
  const nodes = el.lyricBody.querySelectorAll('.lyric-line');
  nodes.forEach((n) => n.classList.remove('active'));
  if (idx >= 0 && nodes[idx]) {
    nodes[idx].classList.add('active');
    nodes[idx].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

/* =========================================================
 * 下载
 * ========================================================= */
async function downloadSong(song) {
  try {
    toast(`正在准备下载：${song.name}`, '');
    const full = state.curSong && state.curSong.source === song.source && state.curSong.id === song.id
      ? state.curSong
      : await apiResolve(song.source, song.id);
    if (!full.url) throw new Error('未获取到下载地址');

    const ext = guessExt(full.url, full.quality);
    const filename = `${full.name} - ${full.artist}.${ext}`.replace(/[\\/:*?"<>|]/g, '_');

    // 优先用 fetch 成 blob 触发下载（可拿到真实文件名）
    try {
      const res = await fetch(full.url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      triggerDownload(URL.createObjectURL(blob), filename);
      toast('下载完成 ✅', 'ok');
    } catch (e) {
      // 跨域受限时，退回直接打开链接
      console.warn('blob 下载失败，改用直链：', e);
      triggerDownload(full.url, filename, true);
      toast('已在新标签打开下载链接', 'ok');
    }
  } catch (e) {
    console.error(e);
    toast('下载失败：' + e.message, 'err');
  }
}

function guessExt(url, quality) {
  const m = String(url).split('?')[0].match(/\.(mp3|flac|m4a|wav|ape|ogg)$/i);
  if (m) return m[1].toLowerCase();
  if (quality && /flac|无损/i.test(quality)) return 'flac';
  return 'mp3';
}

function triggerDownload(href, filename, isExternal = false) {
  const a = document.createElement('a');
  a.href = href;
  if (!isExternal) a.download = filename;
  else a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* =========================================================
 * 事件绑定
 * ========================================================= */
function bindEvents() {
  // 音源切换
  document.querySelectorAll('.source-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.source-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.source = tab.dataset.src;
    });
  });

  // 搜索
  el.btnSearch.addEventListener('click', doSearch);
  el.searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

  // 导航
  el.btnNavSearch.addEventListener('click', () => switchView('search'));
  el.btnNavFav.addEventListener('click', () => switchView('fav'));

  // 搜索结果区：播放 / 添加到 / 收藏 / 下载
  el.searchResult.addEventListener('click', async (e) => {
    // 添加到指定歌单：中间弹窗选择
    const addBtn = e.target.closest('[data-addbtn]');
    if (addBtn) {
      const song = state.results[+addBtn.dataset.addbtn];
      const targetId = await pickPlaylist(song);
      if (targetId) addToPlaylist(song, targetId);
      e.stopPropagation();
      return;
    }
    const opBtn = e.target.closest('[data-op]');
    if (opBtn) {
      const idx = +opBtn.dataset.idx;
      const song = state.results[idx];
      if (opBtn.dataset.op === 'fav') toggleFav(song);
      else if (opBtn.dataset.op === 'download') downloadSong(song);
      e.stopPropagation();
      return;
    }
    const item = e.target.closest('.song-item');
    if (item) playByIndex(+item.dataset.idx, state.results);
  });

  // 新建歌单
  el.btnNewFav.addEventListener('click', async () => {
    const name = await showPrompt('新建歌单', '我的歌单');
    if (name === null) return;
    newPlaylist(name || '新歌单');
  });

  // 歌单标签：切换 / 重命名 / 删除
  el.favTabs.addEventListener('click', async (e) => {
    const renameBtn = e.target.closest('[data-rename]');
    if (renameBtn) {
      const id = renameBtn.dataset.rename;
      const p = state.favStore.playlists.find((x) => x.id === id);
      const name = await showPrompt('重命名歌单', p ? p.name : '');
      if (name !== null) renamePlaylist(id, name);
      e.stopPropagation();
      return;
    }
    const delBtn = e.target.closest('[data-delpl]');
    if (delBtn) {
      deletePlaylist(delBtn.dataset.delpl);
      e.stopPropagation();
      return;
    }
    const tab = e.target.closest('[data-pl]');
    if (tab) switchPlaylist(tab.dataset.pl);
  });

  // 收藏区：播放 / 移除 / 移动
  el.favResult.addEventListener('click', (e) => {
    const moveTarget = e.target.closest('[data-move]');
    if (moveTarget) {
      moveSongTo(+moveTarget.dataset.move, moveTarget.dataset.target);
      e.stopPropagation();
      return;
    }
    const moveBtn = e.target.closest('[data-movebtn]');
    if (moveBtn) {
      const i = moveBtn.dataset.movebtn;
      el.favResult.querySelectorAll('.fav-move-menu').forEach((m) => {
        if (m.dataset.menu !== i) m.hidden = true;
      });
      const menu = el.favResult.querySelector(`.fav-move-menu[data-menu="${i}"]`);
      if (menu) menu.hidden = !menu.hidden;
      e.stopPropagation();
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const i = +del.dataset.del;
      const pl = curPlaylist();
      if (pl) pl.songs.splice(i, 1);
      saveFavStore();
      renderFav();
      refreshFavButtons();
      toast('已移除收藏', '');
      e.stopPropagation();
      return;
    }
    const card = e.target.closest('.fav-card');
    if (card) playByIndex(+card.dataset.idx, curFavSongs());
  });

  // 播放器控制
  el.btnPlay.addEventListener('click', togglePlay);
  el.btnPrev.addEventListener('click', playPrev);
  el.btnNext.addEventListener('click', playNext);

  el.btnShuffle.addEventListener('click', () => {
    if (state.mode === 'shuffle') {
      state.mode = 'loop';
      el.btnShuffle.classList.remove('active');
      toast('顺序播放');
    } else {
      state.mode = 'shuffle';
      el.btnShuffle.classList.add('active');
      el.btnLoop.classList.remove('active');
      toast('随机播放');
    }
  });

  el.btnLoop.addEventListener('click', () => {
    if (state.mode === 'single') {
      state.mode = 'loop';
      el.btnLoop.classList.remove('active');
      toast('列表循环');
    } else {
      state.mode = 'single';
      el.btnLoop.classList.add('active');
      el.btnShuffle.classList.remove('active');
      toast('单曲循环');
    }
  });

  el.btnFavCur.addEventListener('click', () => {
    if (state.curSong) toggleFav(state.curSong);
    else toast('当前没有播放歌曲', 'err');
  });

  // 歌词面板
  el.btnLyric.addEventListener('click', () => el.lyricPanel.classList.add('open'));
  el.btnCloseLyric.addEventListener('click', () => el.lyricPanel.classList.remove('open'));
  el.lyricBody.addEventListener('click', (e) => {
    const line = e.target.closest('.lyric-line');
    if (line && line.dataset.i !== undefined) {
      const t = state.lyrics[+line.dataset.i]?.time;
      if (t !== undefined) el.audio.currentTime = t;
    }
  });

  // 进度条
  el.progressTrack.addEventListener('click', (e) => {
    const r = el.progressTrack.getBoundingClientRect();
    const p = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    if (el.audio.duration) el.audio.currentTime = p * el.audio.duration;
  });

  // 音量
  el.volumeTrack.addEventListener('click', (e) => {
    const r = el.volumeTrack.getBoundingClientRect();
    const p = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    el.audio.volume = p;
    el.volumeFill.style.width = (p * 100) + '%';
  });
  el.btnMute.addEventListener('click', () => {
    el.audio.muted = !el.audio.muted;
    el.btnMute.textContent = el.audio.muted ? '🔇' : '🔊';
  });

  // 音频事件
  el.audio.addEventListener('timeupdate', () => {
    const cur = el.audio.currentTime;
    const dur = el.audio.duration || 0;
    el.curTime.textContent = fmtTime(cur);
    el.totalTime.textContent = fmtTime(dur);
    el.progressFill.style.width = dur ? (cur / dur * 100) + '%' : '0%';
    syncLyric(cur);
  });

  el.audio.addEventListener('ended', () => {
    if (state.mode === 'single') {
      el.audio.currentTime = 0;
      el.audio.play();
    } else {
      playNext();
    }
  });

  el.audio.addEventListener('error', () => {
    if (el.audio.src) toast('音频加载出错，可能链接已失效', 'err');
    el.btnPlay.textContent = '▶';
    state.playing = false;
  });

  // 搜索结果区滚动到底部 → 自动加载下一页
  window.addEventListener('scroll', () => {
    if (!el.viewSearch.classList.contains('active')) return;
    const nearBottom =
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 240;
    if (nearBottom) loadMore();
  }, { passive: true });

  // 全局快捷键：空格播放/暂停
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      togglePlay();
    }
  });
}

/* =========================================================
 * 初始化
 * ========================================================= */
function init() {
  bindEvents();
  renderFav();
  el.audio.volume = 0.8;
  el.volumeFill.style.width = '80%';
  el.btnNavSearch.classList.add('active');
  console.log('%c海棠音乐 已就绪', 'color:#ff4d6d;font-weight:bold;');
}

document.addEventListener('DOMContentLoaded', init);
