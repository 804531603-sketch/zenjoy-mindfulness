// utils/visitor.js - 访客埋点调用层（全程静默，失败绝不影响打卡等主流程）
const cloud = require('./cloud');

const FN = 'zenjoyTrack';
const KEY_DONE = 'zenjoy_lead_done';      // 已留过资
const KEY_SHOWN = 'zenjoy_lead_shown';    // 今天已弹过（同一天不重复打扰）
const KEY_PENDING = 'zenjoy_lead_pending'; // 提交失败暂存，下次重试

function ready() {
  return typeof cloud.isReady === 'function' && cloud.isReady();
}

/** 记录一次访问：在 app.js onLaunch 调用 */
function trackVisit(scene) {
  if (!ready()) return;
  wx.cloud
    .callFunction({ name: FN, data: { action: 'visit', scene: Number(scene) || 0 } })
    .catch(() => {});
}

/** 记录一次打卡：在打卡成功、云端记录上传后调用 */
function trackCheckin(date) {
  if (!ready()) return;
  wx.cloud
    .callFunction({ name: FN, data: { action: 'checkin', date: String(date || '') } })
    .catch(() => {});
}

/**
 * 提交联系方式（用户手填自愿提交）
 * @returns Promise<{ok:boolean, err?:string}>
 */
function submitLead(contact, source) {
  if (!ready()) return Promise.resolve({ ok: false, err: 'cloud_off' });
  return wx.cloud
    .callFunction({
      name: FN,
      data: { action: 'lead', contact: String(contact || '').trim(), source: String(source || '') }
    })
    .then((res) => (res && res.result) || { ok: false, err: 'empty' })
    .catch((e) => ({ ok: false, err: String(e) }));
}

function get(key) {
  try {
    return wx.getStorageSync(key) || '';
  } catch (e) {
    return '';
  }
}
function set(key, val) {
  try {
    wx.setStorageSync(key, val);
  } catch (e) {}
}

const isLeadDone = () => !!get(KEY_DONE);
const markLeadDone = () => set(KEY_DONE, 1);
const getShownDate = () => get(KEY_SHOWN);
const markShownToday = (date) => set(KEY_SHOWN, date);
const getPendingLead = () => get(KEY_PENDING);
const savePendingLead = (c) => set(KEY_PENDING, c);
const clearPendingLead = () => set(KEY_PENDING, '');

module.exports = {
  trackVisit,
  trackCheckin,
  submitLead,
  isLeadDone,
  markLeadDone,
  getShownDate,
  markShownToday,
  getPendingLead,
  savePendingLead,
  clearPendingLead
};
