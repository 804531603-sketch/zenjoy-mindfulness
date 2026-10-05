// pages/daily/daily.js - 每日陪伴：今日一思 + 今日一练
// 内容来源：云端 daily.json（services/daily.js，缓存秒出→静默刷新→本地回退）
// 练习打卡：完成练习后记录到本地（只存手机，隐私如一）
// 练习语音引导：每天对应 practice-NN.mp3（彤彤录音，走云端热更新）；
//   有音频 → 播放按钮；未录制 → 显示"引导准备中"占位，不影响看文字练习。
const dailyService = require('../../services/daily');
const audioManager = require('../../services/audio-manager');
const { formatDate } = require('../../utils/streak');

const DONE_KEY = 'daily_practice_done';

/** 读取练习完成记录 { '2026-08-31': true } */
function readDoneMap() {
  try {
    return wx.getStorageSync(DONE_KEY) || {};
  } catch (e) {
    return {};
  }
}

Page({
  data: {
    dayIndex: 0,       // 当前显示的是第几天（从 0 起；默认今天）
    totalDays: 0,
    todayIndex: 0,     // 今天对应的天数索引（翻页的锚点）
    item: null,        // 当前展示的一天 { title, thought, practice }
    practiceDone: false, // 今天是否已完成练习
    totalDoneCount: 0, // 累计完成练习的天数
    // 练习语音引导状态
    voiceReady: false,   // 当天练习是否已有语音引导音频
    voicePlaying: false, // 是否正在播放引导
    voiceLoading: false  // 首次下载引导音频中的加载提示
  },

  onLoad() {
    this._doneMap = readDoneMap();
    // 拉内容：第一次用缓存/本地秒出；云端有更新时自动刷新
    dailyService.getDays((days) => {
      this._days = days;
      const todayIndex = dailyService.todayIndex(days.length);
      this.setData({
        totalDays: days.length,
        todayIndex,
        dayIndex: todayIndex,
        totalDoneCount: Object.keys(this._doneMap).length
      });
      this.renderDay(todayIndex);
    });

    // 播放状态同步：只在播的是"练习引导"时更新本页按钮状态
    this._offStatus = audioManager.onStatusChange((playing) => {
      const cur = audioManager.getCurrentTrack();
      if (cur && String(cur.id).indexOf('practice-') === 0) {
        this.setData({ voicePlaying: playing });
      } else if (!playing) {
        this.setData({ voicePlaying: false });
      }
    });
    // 首次播放引导时的下载加载提示
    this._offLoading = audioManager.onLoadingChange((on) => {
      const cur = audioManager.getCurrentTrack();
      const isPractice = cur && String(cur.id).indexOf('practice-') === 0;
      this.setData({ voiceLoading: on && isPractice });
    });
  },

  onUnload() {
    if (this._offStatus) this._offStatus();
    if (this._offLoading) this._offLoading();
    // 离开本页时，如果正在播的是练习引导就停掉，不占后台音频；
    // （冥想页的音乐不受影响：它有自己的播放入口）
    const cur = audioManager.getCurrentTrack();
    if (cur && String(cur.id).indexOf('practice-') === 0) {
      audioManager.stop();
    }
  },

  onShow() {
    // 从别的页面回来时刷新完成状态
    this.refreshDone();
  },

  /** 渲染第 index 天的内容 */
  renderDay(index) {
    const item = this._days && this._days[index];
    if (!item) return;
    const isToday = index === this.data.todayIndex;
    const voiceUrl = (item.practice && item.practice.voice) || '';
    this.setData({
      dayIndex: index,
      item: {
        day: index + 1,
        title: item.title,
        reminder: item.reminder || '',
        thought: item.thought,
        practiceName: item.practice.name,
        practiceSteps: item.practice.steps
      },
      practiceDone: isToday ? !!this._doneMap[formatDate(Date.now())] : false,
      voiceReady: !!voiceUrl,
      voicePlaying: false,
      voiceLoading: false
    });
    this._voiceTrack = voiceUrl
      ? { id: `practice-${index + 1}`, name: `${item.practice.name} · 语音引导`, url: voiceUrl, noLoop: true }
      : null;
    // 翻页时停掉上一篇引导，避免旧音频继续播
    const cur = audioManager.getCurrentTrack();
    if (cur && String(cur.id).indexOf('practice-') === 0 && cur.id !== (this._voiceTrack ? this._voiceTrack.id : '')) {
      audioManager.stop();
    }
  },

  /** 播放 / 暂停当天的练习语音引导 */
  onToggleVoice() {
    if (!this._voiceTrack) return;
    if (this.data.voicePlaying) {
      audioManager.pause();
      this.setData({ voicePlaying: false });
    } else {
      audioManager.play(this._voiceTrack);
      this.setData({ voicePlaying: true });
    }
  },

  /** 刷新完成状态（翻页回今天时） */
  refreshDone() {
    if (this.data.dayIndex === this.data.todayIndex) {
      this.setData({ practiceDone: !!this._doneMap[formatDate(Date.now())] });
    }
  },

  /** 翻到上一天 */
  onPrevDay() {
    if (!this._days) return;
    const prev = (this.data.dayIndex - 1 + this._days.length) % this._days.length;
    this.renderDay(prev);
  },

  /** 翻到下一天 */
  onNextDay() {
    if (!this._days) return;
    const next = (this.data.dayIndex + 1) % this._days.length;
    this.renderDay(next);
  },

  /** 回到今天 */
  onBackToday() {
    this.renderDay(this.data.todayIndex);
  },

  /** 完成今日练习（只有"今天"这一天才可打卡） */
  onDonePractice() {
    if (this.data.practiceDone) {
      wx.showToast({ title: '今天已经完成啦', icon: 'none' });
      return;
    }
    const today = formatDate(Date.now());
    this._doneMap[today] = true;
    try { wx.setStorageSync(DONE_KEY, this._doneMap); } catch (e) {}
    this.setData({
      practiceDone: true,
      totalDoneCount: Object.keys(this._doneMap).length
    });
    wx.showToast({ title: '练习完成，真棒', icon: 'none' });
  },

  onShareAppMessage() {
    return {
      title: '每日陪伴 · 今天的一思一练',
      path: '/pages/daily/daily'
    };
  }
});
