// utils/storage.js - 本地缓存封装
// V0.1：wx.setStorageSync；V1.0 换云数据库时只需改这里，页面无感。
const KEY_RECORDS = 'zenjoy_records';
const KEY_SETTINGS = 'zenjoy_settings';

/** 读取全部打卡记录 */
function getRecords() {
  try {
    return wx.getStorageSync(KEY_RECORDS) || [];
  } catch (e) {
    return [];
  }
}

/**
 * 写入一条打卡记录（同一天重复打卡返回 false）
 * @param {Object} record { date, duration, mood, note, ts }
 */
function addRecord(record) {
  const records = getRecords();
  if (records.some((r) => r.date === record.date)) {
    return false; // 今天已打过卡
  }
  records.push(record);
  wx.setStorageSync(KEY_RECORDS, records);
  return true;
}

/** 读取设置（音量、常听音乐等） */
function getSettings() {
  try {
    return wx.getStorageSync(KEY_SETTINGS) || {};
  } catch (e) {
    return {};
  }
}

/** 保存设置 */
function setSettings(settings) {
  wx.setStorageSync(KEY_SETTINGS, settings);
}

/** 全量覆盖记录（云端合并后写回本地用） */
function replaceAll(records) {
  try {
    wx.setStorageSync(KEY_RECORDS, records || []);
  } catch (e) {
    // 写入失败保持现状
  }
}

module.exports = { getRecords, addRecord, replaceAll, getSettings, setSettings };
