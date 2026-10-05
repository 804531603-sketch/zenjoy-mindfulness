// utils/gratitude.js - 感恩日记：打卡后自愿书写，一天一条，可随时回看
// 纯本地存储（不上传云端），内容只属于写它的人。
const KEY = 'zenjoy_gratitude_v1';

function formatDate(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 读取全部日记（按日期倒序，最新在前） */
function getAll() {
  try {
    const list = wx.getStorageSync(KEY) || [];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

/** 读取指定日期（YYYY-MM-DD）的日记文本，没有则为空字符串 */
function getByDate(date) {
  const hit = getAll().find((e) => e.date === date);
  return hit ? hit.text : '';
}

/** 读取今天的日记文本（没有则为空字符串） */
function getTodayText() {
  return getByDate(formatDate(Date.now()));
}

/**
 * 保存/更新今天的日记（同一天重复保存 = 覆盖更新，允许反复修改）
 * @param {String} text 日记内容
 * @returns {Boolean} 是否保存成功
 */
function saveToday(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;
  const today = formatDate(Date.now());
  const list = getAll().filter((e) => e.date !== today);
  list.unshift({ date: today, text: trimmed, ts: Date.now() });
  try {
    wx.setStorageSync(KEY, list);
    return true;
  } catch (e) {
    return false;
  }
}

/** 删除某天的日记 */
function removeByDate(date) {
  try {
    wx.setStorageSync(KEY, getAll().filter((e) => e.date !== date));
  } catch (e) {}
}

/** 展示用日期："8月28日 · 星期五" */
function displayDate(dateStr) {
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const week = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 · 星期${week[d.getDay()]}`;
}

module.exports = { getAll, getByDate, getTodayText, saveToday, removeByDate, displayDate };
