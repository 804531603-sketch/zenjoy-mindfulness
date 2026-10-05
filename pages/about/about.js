// pages/about/about.js - 关于页（含音源署名、免责说明、正念音频领取）
const tracks = require('../../config/tracks');

Page({
  data: {
    version: 'V1.1',
    credits: []
  },

  onLoad() {
    // 音源署名清单直接取自 config/tracks.js，保持单一来源、永不错漏
    const credits = tracks.map(t => ({
      name: t.name,
      license: t.license
    }));
    this.setData({ credits });
  },

  // 连点 logo 7 次进入访客看板（隐藏入口，用户不会误触）
  onTapLogo() {
    this._tapCount = (this._tapCount || 0) + 1;
    if (this._tapCount >= 7) {
      this._tapCount = 0;
      wx.navigateTo({ url: '/pages/admin/admin' });
      return;
    }
    if (this._tapCount >= 4) {
      wx.showToast({ title: `再点 ${7 - this._tapCount} 次`, icon: 'none', duration: 800 });
    }
    clearTimeout(this._tapTimer);
    this._tapTimer = setTimeout(() => { this._tapCount = 0; }, 2500);
  },

  // 领取 7 天正念引导音频
  onGoLead() {
    wx.navigateTo({ url: '/pages/lead/lead?source=about' });
  }
});
