// cloudfunctions/seedAudio/index.js - 一次性音频搬迁函数（v2）
//
// 作用：把站点上的 17 个音频（7 疗愈频率音 + 10 人声引导）
//       下载到云端，上传到本环境【云存储】，并打印每个文件的 cloud:// 文件ID。
//
// 为什么需要它：静态托管域名 your-cdn.example.com 的备案主体
//   不是小程序主体，公众平台 downloadFile 合法域名加不进去（微信硬性限制）。
//   微信云存储自家 CDN 天然信任、免白名单、免备案，是小程序音频的正解。
//
// 用法（一次性）：
//   1. 开发者工具左侧 seedAudio 右键 →「上传并部署：云端安装依赖」
//   2. 右键 →「云函数测试」→ 调用，等待返回（约 20~60 秒）
//   3. 把返回的 FILEID 行截图发给助手即可（助手会填进 tracks.js）
//
// 跑完后本函数可删除，不影响任何功能。

const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const BASE = 'https://your-cdn.example.com';

// 现网 17 个音频：7 疗愈频率音 + 10 人声引导
const PATHS = [
  // 疗愈频率音（各 15 分钟）
  'schumann.mp3',
  '432.mp3',
  '528.mp3',
  '963.mp3',
  '111.mp3',
  '639.mp3',
  '741.mp3',
  // 人声引导（原创 · 彤彤）
  'voice/v01.mp3',
  'voice/v02.mp3',
  'voice/v03.mp3',
  'voice/v04.mp3',
  'voice/v05.mp3',
  'voice/v06.mp3',
  'voice/v07.mp3',
  'voice/v08.mp3',
  'voice/v09.mp3',
  'voice/v10.mp3'
];

/** 服务端下载一个文件为 Buffer（普通 Node 请求，无微信 UA，不会被 403） */
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error('HTTP ' + res.statusCode + ' ' + url));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

/** 下载并上传单个文件，返回结果行 */
async function seedOne(p) {
  const cloudPath = 'audio/' + p;
  try {
    const buf = await fetchBuffer(BASE + '/' + p);
    const r = await cloud.uploadFile({ cloudPath, fileContent: buf });
    return 'FILEID ' + cloudPath + ' ' + r.fileID + ' (' + (buf.length / 1024 / 1024).toFixed(1) + 'MB)';
  } catch (e) {
    return 'FAIL ' + cloudPath + ' ' + (e.message || e.errMsg || String(e));
  }
}

exports.main = async () => {
  // 并行搬全部 17 个（云端内网快，单次远低于 60s 超时）
  const lines = await Promise.all(PATHS.map((p) => seedOne(p)));
  const ok = lines.filter((l) => l.startsWith('FILEID')).length;
  const fail = lines.length - ok;
  lines.unshift('---- seedAudio 完成: 成功 ' + ok + ' / 失败 ' + fail + ' / 共 ' + PATHS.length + ' ----');
  if (fail === 0) {
    lines.push('---- 全部成功。请把上面的 FILEID 行整段截图/复制发给助手 ----');
  } else {
    lines.push('---- 有失败项，请把结果发助手，我排查 ----');
  }
  return lines.join('\n');
};
