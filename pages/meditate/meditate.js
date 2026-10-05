// pages/meditate/meditate.js - 冥想页：呼吸引导 + 音乐 + 定时 + 感恩日记 + 结束打卡
const audioManager = require('../../services/audio-manager');
const playlistService = require('../../services/playlist');
const quotes = require('../../utils/quotes');
const gratitude = require('../../utils/gratitude');

const app = getApp();

const TIMER_OPTIONS = [
  { label: '不定时', value: 0 },
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '60 分钟', value: 60 }
];

// 呼吸相位：与 CSS 动画 12s 循环对齐（吸气4s→屏息4s→呼气4s）
const BREATH_PHASES = ['吸气', '屏息', '呼气'];

/** 秒数 → "m:ss" 文本 */
function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

Page({
  data: {
    quote: '',
    tracks: [],
    currentTrackIndex: -1,
    playing: false,
    timerOptions: TIMER_OPTIONS,
    timerIndex: 0,
    elapsedText: '00:00',
    sessionStart: 0,
    statusBarHeight: 20,
    // 呼吸相位文字
    breathText: '呼吸',
    // 音乐进度（秒）与格式化文本
    audioCurrent: 0,
    audioDuration: 0,
    audioCurrentText: '0:00',
    audioDurationText: '0:00',
    // 音乐加载/缓冲中的温和提示（带下载百分比，缓解首次点播等待）
    trackLoading: false,
    loadHintText: '加载中…',
    // 第三板块：感恩日记（静坐后的温柔延伸，自愿书写）
    gratInput: '',
    gratCount: 0,
    gratHistory: [],
    // 当前展开的日记日期（点开才显示全文，默认收起）
    gratOpen: ''
  },

  onLoad() {
    const sysInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const statusBarHeight = sysInfo.statusBarHeight || 20;
    this.setData({
      quote: quotes.getDailyQuote(),
      sessionStart: app.globalData.sessionStart || Date.now(),
      // 自定义导航需避开状态栏
      statusBarHeight
    });

    // 云端曲库：秒出本地/缓存版 → 云端有更新时静默刷新（新增引导无需重新提审）
    playlistService.getTracks((list) => this.applyTracks(list));
    // 计时用时间戳差值，不依赖前台定时器（切后台也准）
    this._timer = setInterval(() => {
      this.updateElapsed();
    }, 1000);
    this.updateElapsed();

    // 呼吸相位轮播（与 12s CSS 动画同步）
    this._phaseIndex = 0;
    this._phaseTimer = setInterval(() => this.nextBreathPhase(), 4000);
    this.nextBreathPhase();

    // 真实播放状态监听（替代猜测式同步）
    this._offStatus = audioManager.onStatusChange((playing) => {
      this.setData({ playing });
    });

    // 下载缓冲提示：新曲目下载期间显示"加载中 35%"，开播即隐藏
    this._offLoading = audioManager.onLoadingChange((on) => {
      this.setData({ trackLoading: on, loadHintText: '加载中…' });
    });
    // 下载进度：百分比实时显示（音乐体积瘦身后，通常几秒内完成）
    this._offProgress = audioManager.onDownloadProgress((pct) => {
      if (!this.data.trackLoading) return;
      if (pct >= 0) {
        this.setData({ loadHintText: `加载中 ${Math.min(99, Math.round(pct))}%` });
      }
    });

    // 切歌监听：自动衔接切到下一首时，同步列表高亮到正在播的那首
    this._offTrack = audioManager.onTrackChange((track) => {
      const idx = this.data.tracks.findIndex(t => t.id === track.id);
      if (idx >= 0 && idx !== this.data.currentTrackIndex) {
        this.setData({ currentTrackIndex: idx });
      }
    });

    // 音乐进度监听（进度条用）
    this._onTimeUpdate = () => {
      const bgm = audioManager.bgm;
      if (!bgm.src) return;
      const cur = Math.floor(bgm.currentTime || 0);
      const dur = Math.floor(bgm.duration || 0);
      if (cur !== this.data.audioCurrent || dur !== this.data.audioDuration) {
        this.setData({
          audioCurrent: cur,
          audioDuration: dur,
          audioCurrentText: fmtTime(cur),
          audioDurationText: fmtTime(dur)
        });
      }
    };
    audioManager.bgm.onTimeUpdate(this._onTimeUpdate);

    // 加载中反馈：网络缓冲时显示「加载中…」，避免点了像没反应
    this._onWaiting = () => this.setData({ trackLoading: true });
    this._onCanplay = () => this.setData({ trackLoading: false });
    audioManager.bgm.onWaiting(this._onWaiting);
    audioManager.bgm.onCanplay(this._onCanplay);

    // 第三板块：感恩日记初始化（今天已写过则回填，允许反复修改）
    this.refreshGratitude();

    // 防误触：返回前温和确认（基础库 2.12+ 支持；旧版本自动忽略）
    if (wx.enableAlertBeforeUnload) {
      wx.enableAlertBeforeUnload({
        message: '冥想还没结束，确定要离开吗？',
        confirmText: '离开',
        cancelText: '继续静坐',
        fail: () => {}
      });
    }
  },

  /** 应用曲目列表：渲染界面 + 注册播放列表 + 启动后台全量预下载（秒响） */
  applyTracks(list) {
    if (!Array.isArray(list) || !list.length) return;
    this.setData({ tracks: list });
    // 注册播放列表：播完自动切下一首（语音引导轨自动跳过），直到定时结束
    audioManager.setPlaylist(list);
    // 秒响优化：Wi-Fi 下全量排队预下载、流量下只预下载语音引导；
    // 正在播的曲目若已在缓存队列里，点播依然秒响
    audioManager.prefetchTracks(list);
    // Wi-Fi 下后台静默预载本地人声分包（运行时加载，无 2MB 总量限制）
    audioManager.prefetchVoicePkgs(list);
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer);
    if (this._phaseTimer) clearInterval(this._phaseTimer);
    if (this._offStatus) this._offStatus();
    if (this._offLoading) this._offLoading();
    if (this._offProgress) this._offProgress();
    if (this._offTrack) this._offTrack();
    if (this._onTimeUpdate) {
      audioManager.bgm.offTimeUpdate(this._onTimeUpdate);
    }
    if (this._onWaiting) {
      audioManager.bgm.offWaiting(this._onWaiting);
    }
    if (this._onCanplay) {
      audioManager.bgm.offCanplay(this._onCanplay);
    }
    // 返回离开冥想页时不暂停音乐：BackgroundAudioManager 在后台继续陪伴，
    // 直到用户正式点击"结束冥想 · 打卡"（见 onEnd → audioManager.stop）。
    if (wx.disableAlertBeforeUnload) {
      wx.disableAlertBeforeUnload({ fail: () => {} });
    }
    // 中途离开（按返回键，未点"结束冥想·打卡"）：静坐时长不丢，
    // 暂存到全局，回到首页会温柔询问要不要补打卡。
    // （正常结束流程 onEnd 已先把 inSession 置 false，不会走到这里）
    if (app.globalData.inSession) {
      const minutes = Math.floor((Date.now() - this.data.sessionStart) / 60000);
      app.globalData.inSession = false;
      if (minutes >= 1) {
        app.globalData.pendingCheckin = { duration: minutes };
      }
    }
  },

  onShow() {
    // 从后台回来：校验定时停止 + 同步播放状态
    if (audioManager.getTimerRemainSec() === 0) {
      this.setData({ playing: false });
    }
    this.setData({ playing: audioManager.isPlaying() });
    // 从「全部日记」页返回时同步最新记录
    this.refreshGratitude();
    // 重新挂上"离开确认"拦截（跳转日记页时曾临时关闭）
    this.enableLeaveGuard();
  },

  // ---------- 第三板块：感恩日记 ----------
  /** 刷新日记区：回填今天的已保存内容 + 最近三篇历史 */
  refreshGratitude() {
    const todayText = gratitude.getTodayText();
    const all = gratitude.getAll();
    const history = all.slice(0, 3).map((e) => ({
      date: e.date,
      dateText: gratitude.displayDate(e.date),
      text: e.text
    }));
    this.setData({
      gratInput: todayText,
      gratCount: todayText.length,
      gratHistory: history
    });
  },

  onGratInput(e) {
    const v = e.detail.value;
    this.setData({ gratInput: v, gratCount: v.length });
  },

  onGratSave() {
    const text = this.data.gratInput.trim();
    if (!text) {
      wx.showToast({ title: '写一点想感谢的事吧', icon: 'none' });
      return;
    }
    const ok = gratitude.saveToday(text);
    if (ok) {
      wx.showToast({ title: '已收下这份感恩', icon: 'none' });
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} });
      this.refreshGratitude();
    } else {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  /** 点开/收起某篇日记全文（默认只显示日期，不露内容） */
  onToggleGratItem(e) {
    const date = e.currentTarget.dataset.date;
    this.setData({ gratOpen: this.data.gratOpen === date ? '' : date });
  },

  onGratDelete(e) {
    const date = e.currentTarget.dataset.date;
    wx.showModal({
      title: '删除这条日记？',
      content: '删除后无法恢复',
      confirmText: '删除',
      confirmColor: '#C89268',
      success: (r) => {
        if (r.confirm) {
          gratitude.removeByDate(date);
          // 删的是正展开的那篇，收起状态一并清掉
          if (this.data.gratOpen === date) this.setData({ gratOpen: '' });
          this.refreshGratitude();
          wx.showToast({ title: '已删除', icon: 'none' });
        }
      }
    });
  },

  /** 去每日陪伴（想先静坐、后做练习的顺路入口）。
   *  音乐在后台继续陪伴，从每日页返回后可继续静坐；
   *  先临时关闭"离开确认"拦截，避免跳转时被误拦 */
  onGoDaily() {
    if (wx.disableAlertBeforeUnload) {
      wx.disableAlertBeforeUnload({ fail: () => {} });
    }
    wx.navigateTo({ url: '/pages/daily/daily' });
  },

  /** 跳转到感恩日记完整页（查看全部历史）
   *  先临时关闭"离开确认"拦截，避免看日记返回时被误拦 */
  onGoGratitudeAll() {
    if (wx.disableAlertBeforeUnload) {
      wx.disableAlertBeforeUnload({ fail: () => {} });
    }
    wx.navigateTo({ url: '/pages/gratitude/gratitude' });
  },

  /** 重新启用"离开确认"拦截（从日记页返回后调用） */
  enableLeaveGuard() {
    if (wx.enableAlertBeforeUnload) {
      wx.enableAlertBeforeUnload({
        message: '冥想还没结束，确定要离开吗？',
        confirmText: '离开',
        cancelText: '继续静坐',
        fail: () => {}
      });
    }
  },

  nextBreathPhase() {
    this.setData({ breathText: BREATH_PHASES[this._phaseIndex % BREATH_PHASES.length] });
    this._phaseIndex++;
  },

  updateElapsed() {
    const sec = Math.floor((Date.now() - this.data.sessionStart) / 1000);
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    this.setData({ elapsedText: `${m}:${s}` });
  },

  // ---- 音乐控制 ----
  onSelectTrack(e) {
    const index = e.currentTarget.dataset.index;
    const track = this.data.tracks[index];
    if (!track) return;
    // 素材还没上传的音轨（url 为空）：温和提示，不假播放
    if (!track.url) {
      let tip = track.noLoop ? '语音引导录制中，敬请期待' : '这首音乐即将上线';
      if (track.category === 'follow') tip = '356 跟练录制中，敬请期待';
      wx.showToast({ title: tip, icon: 'none' });
      return;
    }
    audioManager.play(track);
    this.setData({ currentTrackIndex: index, playing: true });
  },

  onTogglePlay() {
    const { currentTrackIndex, playing } = this.data;
    if (currentTrackIndex < 0) {
      // 还没选过曲目：默认播播放列表里第一首有链接的普通音轨
      const firstIdx = this.data.tracks.findIndex(t => t.url && !t.noLoop);
      this.onSelectTrack({ currentTarget: { dataset: { index: Math.max(0, firstIdx) } } });
      return;
    }
    if (playing) {
      audioManager.pause();
    } else {
      audioManager.resume();
    }
    // playing 状态由 onStatusChange 回调统一更新，这里不手动 setData
  },

  // 上一首 / 下一首：播放列表内部循环切换（自动跳过语音引导轨）
  // 切歌后由 onTrackChange 监听同步列表高亮，这里无需手动处理
  onPrev() {
    audioManager.playPrev();
  },

  onNext() {
    audioManager.playNext();
  },

  // 进度条拖动跳转
  onSeek(e) {
    const seconds = Number(e.detail.value);
    if (this.data.audioDuration > 0) {
      audioManager.seek(seconds);
      this.setData({ audioCurrent: seconds });
    }
  },

  onTimerChange(e) {
    const index = Number(e.detail.value);
    audioManager.setTimer(TIMER_OPTIONS[index].value);
    this.setData({ timerIndex: index });
    if (TIMER_OPTIONS[index].value > 0) {
      wx.showToast({ title: `${TIMER_OPTIONS[index].value} 分钟后自动停止`, icon: 'none' });
    }
  },

  // ---- 结束冥想 ----
  onEnd() {
    const minutes = Math.floor((Date.now() - this.data.sessionStart) / 60000);
    if (minutes < 1) {
      wx.showToast({ title: '再坚持一会儿，满 1 分钟才算打卡哦', icon: 'none' });
      return;
    }
    // 结束前关闭返回拦截，让 navigateBack 直接通过
    if (wx.disableAlertBeforeUnload) {
      wx.disableAlertBeforeUnload({ fail: () => {} });
    }
    // 彻底停止：音乐干净收尾、定时清零，不留后台残音
    audioManager.stop();
    app.globalData.inSession = false;

    // 回到首页弹打卡窗：
    // 无论从哪条路进冥想页（首页直达 / 每日陪伴页中转），都找到首页再返回。
    const pages = getCurrentPages();
    let homeIndex = -1;
    for (let i = pages.length - 2; i >= 0; i--) {
      if (pages[i].route === 'pages/index/index') { homeIndex = i; break; }
    }
    const homePage = homeIndex >= 0 ? pages[homeIndex] : null;
    if (homePage) {
      // delta = 当前页到首页之间要退掉的层数（含当前页自己那层）
      wx.navigateBack({ delta: pages.length - 1 - homeIndex });
      homePage.onMeditationFinished({ duration: minutes });
    } else {
      // 兜底：极端情况下找不到首页（几乎不会发生），直接返回
      wx.navigateBack();
    }
  }
});
