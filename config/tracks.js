// config/tracks.js - 曲目清单（https 直链版 v5 · 0 费用）
//
// 2026-09-24 最终方案（解决 iPhone 真机"无声音"）：
//   iOS 两个播放器实质都只吃 http/https（包内/分包路径报 -1100、后台播放器直接拒收），
//   且 iOS 文件系统读不到分包资源。故全部音频改走免费静态托管 https 直链：
//   · 10 篇原创人声 + 7 首疗愈频率音（各 15 分钟）托管在「7天领取页」同一站点（永久免费）；
//   · 人声首播直接流式播放，后台自动缓存到手机，之后离线也能听；
//   · 小程序包体瘦身：删除全部音频分包（包体回到 1MB 出头）。
//
// url 字段说明：全部为 https 直链，来自 config/host.js。
//
// 特殊字段：
//   · noLoop: true —— 人声引导专用：播完即止，不参与自动衔接循环；
//     播放器据此切 InnerAudioContext（静音可出声），音乐走后台播放器（锁屏续播）。
//   · 云端合流时 noLoop 轨永不被云端覆盖（见 services/playlist.js）。
const HOST = require('./host');

module.exports = [
  // ---- 疗愈频率音（5 类纯频率疗愈音，各 15 分钟，联网流式 + 循环陪伴）----
  {
    id: 'freq-schumann',
    name: '舒曼共振 7.83Hz',
    desc: '地球脉动，安心落地',
    url: `${HOST}/schumann.mp3`,
    license: 'AI 生成纯频率音 · 禅悦',
    cover: ''
  },
  {
    id: 'freq-432',
    name: '432 Hz 和谐频率',
    desc: '回到自然振动',
    url: `${HOST}/432.mp3`,
    license: 'AI 生成纯频率音 · 禅悦',
    cover: ''
  },
  {
    id: 'freq-528',
    name: '528 Hz 爱的频率',
    desc: '松弛与疗愈',
    url: `${HOST}/528.mp3`,
    license: 'AI 生成纯频率音 · 禅悦',
    cover: ''
  },
  {
    id: 'freq-963',
    name: '963 Hz 宇宙频率',
    desc: '静定与扩展',
    url: `${HOST}/963.mp3`,
    license: 'AI 生成纯频率音 · 禅悦',
    cover: ''
  },
  {
    id: 'freq-111',
    name: '111 Hz 生根频率',
    desc: '安定根基',
    url: `${HOST}/111.mp3`,
    license: 'AI 生成纯频率音 · 禅悦',
    cover: ''
  },
  {
    id: 'freq-639',
    name: '639 Hz 联结频率',
    desc: '敞开与连结',
    url: `${HOST}/639.mp3`,
    license: 'AI 生成纯频率音 · 禅悦',
    cover: ''
  },
  {
    id: 'freq-741',
    name: '741 Hz 清理频率',
    desc: '净化与表达',
    url: `${HOST}/741.mp3`,
    license: 'AI 生成纯频率音 · 禅悦',
    cover: ''
  },
  // ---- 人声引导（原创 · 彤彤；https 直链 + 自动缓存，播完即止）----
  {
    id: 'voice-bodyscan',
    name: '01 身体扫描',
    desc: '陪你和身体躺在一起',
    url: `${HOST}/voice/v01.mp3`,
    license: '原创录音 · 彤彤',
    noLoop: true,
    cover: ''
  },
  {
    id: 'voice-neihai',
    name: '02 内在小孩',
    desc: '陪你遇见小时候的你',
    url: `${HOST}/voice/v02.mp3`,
    license: '原创录音 · 彤彤',
    noLoop: true,
    cover: ''
  },
  {
    id: 'voice-guanhuai',
    name: '03 自我关怀',
    desc: '陪你做自己的朋友',
    url: `${HOST}/voice/v03.mp3`,
    license: '原创录音 · 彤彤',
    noLoop: true,
    cover: ''
  },
  {
    id: 'voice-fangxia',
    name: '04 放下焦虑',
    desc: '陪你看念头来来去去',
    url: `${HOST}/voice/v04.mp3`,
    license: '原创录音 · 彤彤',
    noLoop: true,
    cover: ''
  },
  {
    id: 'voice-ganen',
    name: '05 练习感恩',
    desc: '陪你收集一天里的光',
    url: `${HOST}/voice/v05.mp3`,
    license: '原创录音 · 彤彤',
    noLoop: true,
    cover: ''
  },
  {
    id: 'voice-daoyu',
    name: '06 安全之地',
    desc: '陪你建一座属于你的岛',
    url: `${HOST}/voice/v06.mp3`,
    license: '原创录音 · 彤彤',
    noLoop: true,
    cover: ''
  },
  {
    id: 'voice-huidao',
    name: '07 回到自己',
    desc: '陪你十分钟回到你自己',
    url: `${HOST}/voice/v07.mp3`,
    license: '原创录音 · 彤彤',
    noLoop: true,
    cover: ''
  },
  {
    id: 'voice-shenshui',
    name: '08 深睡引导',
    desc: '陪你把这一天放下',
    url: `${HOST}/voice/v08.mp3`,
    license: '原创录音 · 彤彤',
    noLoop: true,
    cover: ''
  },
  {
    id: 'voice-guanzhao',
    name: '09 观照内在',
    desc: '陪你看清，再没什么值得紧抓不放',
    url: `${HOST}/voice/v09.mp3`,
    license: '原创录音 · 彤彤',
    noLoop: true,
    cover: ''
  },
  {
    id: 'voice-qingchen',
    name: '10 清晨练习',
    desc: '陪你问一句：此刻，我想要的是什么',
    url: `${HOST}/voice/v10.mp3`,
    license: '原创录音 · 彤彤',
    noLoop: true,
    cover: ''
  },
  // ---- 356 跟练（每日一练语音引导，持续更新；当前预留，上传音频后在此填 url）----
  {
    id: 'follow-356',
    name: '356 跟练',
    desc: '每日一练语音引导',
    url: '',
    noLoop: true,
    category: 'follow',
    cover: ''
  }
];
