// app.js - 禅悦·正念打卡（V1.0 云同步版）
const audioManager = require('./services/audio-manager');
const cloud = require('./utils/cloud');
const visitor = require('./utils/visitor');
const playlistSvc = require('./services/playlist');

App({
  globalData: {
    // 本次冥想的开始时间戳（跨页面传递）
    sessionStart: 0,
    // 是否处于冥想会话中
    inSession: false,
    // 未完成的打卡：冥想中途离开（未点"结束冥想·打卡"）时暂存时长，
    // 回到首页温柔询问是否补打卡，静坐成果不白白丢掉
    pendingCheckin: null
  },

  onLaunch() {
    // 云开发初始化：未配置环境 ID 时自动降级为纯本地模式
    cloud.init();

    // 访客埋点：记录「谁打开了小程序」（只存 openid，不碰任何身份信息）
    // 未开通云开发时 visitor 内部自动跳过，不影响启动速度
    try {
      const opt = wx.getLaunchOptionsSync ? wx.getLaunchOptionsSync() : {};
      visitor.trackVisit(opt.scene);
    } catch (e) {}

    // 正式版：关闭调试模式（2026-08-28 发版收尾）。
    // 开发期曾用它绕过域名校验，正式版改走合法域名白名单（免费）：
    // 公众平台「开发管理→开发设置→服务器域名」已配置 request/downloadFile。
    // 排查问题需临时开回时，把 false 改 true 即可。
    if (wx.setEnableDebug) {
      wx.setEnableDebug({ enableDebug: false, fail: () => {} });
    }

    // 秒响优化：App 一打开就在后台备音频（开屏海报/看首页时已经在下载），
    // 进冥想页基本零等待。引导优先；Wi-Fi 全量、流量只备引导，不费流量。
    playlistSvc.getTracks((tracks) => {
      audioManager.prefetchTracks(tracks);
    });
  },

  onHide() {
    // 切后台时音频由 BackgroundAudioManager 自动续播，无需处理
  }
});
