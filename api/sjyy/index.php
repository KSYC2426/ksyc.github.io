<?php
// 设置响应头
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

// 定义一言文件路径
$hitokotoFile = __DIR__ . '/hitokoto.txt';

// 检查文件是否存在
if (!file_exists($hitokotoFile)) {
    http_response_code(500);
    die(json_encode([
        'code' => 500,
        'message' => '一言数据文件不存在',
        'data' => null
    ], JSON_UNESCAPED_UNICODE));
}

// 读取文件内容
$hitokotos = file($hitokotoFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

// 检查是否读取成功
if ($hitokotos === false || empty($hitokotos)) {
    http_response_code(500);
    die(json_encode([
        'code' => 500,
        'message' => '无法读取一言数据或数据为空',
        'data' => null
    ], JSON_UNESCAPED_UNICODE));
}

// 随机选择一条一言
$randomHitokoto = trim($hitokotos[array_rand($hitokotos)]);

// 返回结果
echo json_encode([
    'code' => 200,
    'message' => 'success',
    'data' => [
        'hitokoto' => $randomHitokoto,
        'length' => mb_strlen($randomHitokoto, 'UTF-8'),
        'timestamp' => time(),
        'from' => '本地文本文件'
    ]
], JSON_UNESCAPED_UNICODE);
?>