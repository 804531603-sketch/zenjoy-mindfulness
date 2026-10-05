// pages/admin/admin.js - 访客看板（隐藏页）
//
// 入口：关于页连点「禅」字 logo 7 次
// 数据来自云函数 zenjoyAdmin（管理员权限，才能读到全部访客）
const cloud = require('../../utils/cloud');

const FN = 'zenjoyAdmin';
const KEY_PWD = 'zenjoy_admin_pwd';

Page({
  data: {
    pwd: '',
    authed: false,
    loading: false,
    err: '',
    tab: 'visitor',
    stats: null,
    list: [],
    leadList: [],
    updatedAt: '',
    cloudOff: false
  },

  onLoad() {
    // 幂等：已初始化则内部静默失败，不报错
    cloud.init();
    if (!cloud.isReady()) {
      this.setData({ cloudOff: true });
      return;
    }
    // 记住上次输对的密码，下次进来免输
    let saved = '';
    try {
      saved = wx.getStorageSync(KEY_PWD) || '';
    } catch (e) {}
    if (saved) {
      this.setData({ pwd: saved });
      this.load(saved);
    }
  },

  onPwdInput(e) {
    this.setData({ pwd: e.detail.value, err: '' });
  },

  onLogin() {
    const pwd = this.data.pwd.trim();
    if (!pwd) {
      this.setData({ err: '先输入密码' });
      return;
    }
    this.load(pwd);
  },

  load(pwd) {
    if (this.data.loading) return;
    this.setData({ loading: true, err: '' });
    wx.cloud
      .callFunction({ name: FN, data: { pwd: pwd } })
      .then((res) => {
        const r = (res && res.result) || {};
        this.setData({ loading: false });
        if (!r.ok) {
          this.setData({ authed: false, err: r.err === 'pwd' ? '密码不对' : '读取失败，稍后再试' });
          return;
        }
        try {
          wx.setStorageSync(KEY_PWD, pwd);
        } catch (e) {}
        this.setData({
          authed: true,
          stats: r.stats,
          list: r.list || [],
          leadList: r.leadList || [],
          updatedAt: r.updatedAt || ''
        });
      })
      .catch(() => {
        this.setData({ loading: false, err: '云函数没连上，检查是否已部署 zenjoyAdmin' });
      });
  },

  onRefresh() {
    this.load(this.data.pwd);
  },

  onSwitchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  onLogout() {
    try {
      wx.removeStorageSync(KEY_PWD);
    } catch (e) {}
    this.setData({ authed: false, pwd: '', stats: null, list: [], leadList: [] });
  },

  // 长按复制联系方式，直接去微信里加好友
  onCopy(e) {
    const text = e.currentTarget.dataset.text;
    if (!text) return;
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制，去微信添加', icon: 'none' })
    });
  }
});
