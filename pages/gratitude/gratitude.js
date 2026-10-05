// pages/gratitude/gratitude.js - 感恩日记：书写 + 回看
// 定位：打卡后的温柔延伸，自愿、无压力；内容纯本地存储。
const gratitude = require('../../utils/gratitude');

Page({
  data: {
    // 今天的书写区
    todayText: '',
    inputText: '',
    charCount: 0,
    // 历史记录（倒序，最新在前）
    history: [],
    // 空状态
    isEmpty: true
  },

  onLoad() {
    this.refresh();
    // 今天的已有内容回填到输入框
    const today = gratitude.getTodayText();
    if (today) {
      this.setData({ inputText: today, charCount: today.length });
    }
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const all = gratitude.getAll();
    const history = all.map((e) => ({
      date: e.date,
      dateText: gratitude.displayDate(e.date),
      text: e.text
    }));
    this.setData({ history, isEmpty: history.length === 0 });
  },

  onInput(e) {
    const v = e.detail.value;
    this.setData({ inputText: v, charCount: v.length });
  },

  onSave() {
    const text = this.data.inputText.trim();
    if (!text) {
      wx.showToast({ title: '写一点想感谢的事吧', icon: 'none' });
      return;
    }
    const ok = gratitude.saveToday(text);
    if (ok) {
      wx.showToast({ title: '已收下这份感恩', icon: 'none' });
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} });
      this.refresh();
    } else {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  onDelete(e) {
    const date = e.currentTarget.dataset.date;
    wx.showModal({
      title: '删除这条日记？',
      content: '删除后无法恢复',
      confirmText: '删除',
      confirmColor: '#C89268',
      success: (r) => {
        if (r.confirm) {
          gratitude.removeByDate(date);
          // 删的是今天那条，把输入区也清空
          if (date === this.todayStr()) {
            this.setData({ inputText: '', charCount: 0 });
          }
          this.refresh();
          wx.showToast({ title: '已删除', icon: 'none' });
        }
      }
    });
  },

  todayStr() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
});
