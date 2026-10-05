// config/host.js - 音源托管域名（唯一出处）
// tracks.js / services/playlist.js 都从这里取，换域名时只改这一处。
// 当前指向「7天领取页」同一个免费静态站（禅悦音源目录，永久免费、不会过期清空）。
// 正式提审前（可选但推荐）：公众平台「开发管理→开发设置→服务器域名」
//   把该域名加入 downloadFile 合法域名（免费），人声离线缓存在正式版也能生效。
//   注意：即使不加，人声/音乐仍可通过 https 直接播放（媒体资源不走域名校验）。
const HOST = 'https://your-cdn.example.com';

module.exports = HOST;
