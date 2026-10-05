// pages/lead/lead.js - 领取 7 天正念引导音频（留资钩子）
//
// 原则：只收用户主动填写的联系方式，不采集任何隐私；
// 网络失败时把内容暂存本地，下次进来自动补发，线索不丢。
const visitor = require('../../utils/visitor');

Page({
  data: {
    contact: '',
    submitting: false,
    done: false,
    source: 'unknown'
  },

  onLoad(query) {
    this.setData({ source: (query && query.source) || 'unknown' });
    // 上次提交失败暂存的内容，静默补发一次
    const pending = visitor.getPendingLead();
    if (pending && !visitor.isLeadDone()) {
      visitor.submitLead(pending, 'retry').then((r) => {
        if (r.ok) {
          visitor.markLeadDone();
          visitor.clearPendingLead();
        }
      });
    }
  },

  onInput(e) {
    this.setData({ contact: e.detail.value });
  },

  onSubmit() {
    if (this.data.submitting) return;
    const contact = this.data.contact.trim();
    if (!contact) {
      wx.showToast({ title: '先留个微信号吧', icon: 'none' });
      return;
    }
    if (contact.length > 60) {
      wx.showToast({ title: '太长了，检查一下？', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    visitor.submitLead(contact, this.data.source).then((r) => {
      this.setData({ submitting: false });
      if (r.ok) {
        visitor.markLeadDone();
        visitor.clearPendingLead();
        this.setData({ done: true });
      } else {
        visitor.savePendingLead(contact);
        wx.showToast({
          title: '网络不太好，已先帮你存着',
          icon: 'none',
          duration: 2500
        });
      }
    });
  },

  onGoBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) });
  }
});
