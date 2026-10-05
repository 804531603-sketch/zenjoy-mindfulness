// services/daily.js - 云端「每日陪伴」内容（热更新，0 费用方案）
// 原理：与曲库相同 —— 内容清单（daily.json）放在免费托管域名，小程序启动时拉取；
//       以后姐姐每天新增内容，只需更新 daily.json + 重新部署，用户打开即有，
//       不需要重新提审小程序版本。
// 容错：网络拉不到 / 格式异常 → 回退本地 config/daily.js，功能永不中断。
// 流量：清单只有十几 KB；首次成功后缓存到 storage，下次先用缓存再静默更新。
const HOST = require('../config/host');
const localDaily = require('../config/daily');

const CACHE_KEY = 'cloud_daily_v1';
const MANIFEST_URL = HOST + '/daily.json';

/** 简单校验：必须是非空数组，且每项有 title / thought / practice */
function validDays(list) {
  return Array.isArray(list) && list.length > 0 &&
    list.every((d) => d && d.title && d.thought && d.practice && d.practice.name);
}

/** 读取本地缓存的清单（无则 null） */
function readCache() {
  try {
    const raw = wx.getStorageSync(CACHE_KEY);
    if (raw && raw.days && validDays(raw.days)) return raw;
  } catch (e) {}
  return null;
}

/**
 * 获取每日陪伴内容列表（回调式，兼容各基础库）
 * @param {Function} cb (days) —— 可能回调 1~2 次，永远至少一次，永不失败
 *   第一次：缓存（二次启动秒出）或本地打包版（首次启动也秒出）；
 *   第二次：云端有更新时，静默刷新界面。
 */
function getDays(cb) {
  // 1. 立即给内容：缓存优先，没缓存用本地打包版 —— 界面永不空白
  const cached = readCache();
  cb(cached ? cached.days : localDaily.DAILY);

  // 2. 静默拉云端：版本有变化才更新缓存 + 回调刷新界面
  wx.request({
    url: MANIFEST_URL + '?t=' + Date.now(),
    method: 'GET',
    dataType: 'json',
    timeout: 8000,
    success: (res) => {
      const body = res && res.data;
      if (res.statusCode === 200 && body && validDays(body.days)) {
        if (cached && cached.rev === body.rev) return; // 版本没变，无需刷新
        try { wx.setStorageSync(CACHE_KEY, body); } catch (e) {}
        cb(body.days);
      }
      // 拉到的内容无效：保留现状，静默忽略
    }
    // 网络失败：不做任何事，界面保持第一步的内容
  });
}

/** 按日期计算当天是第几天（1 月 1 日 = 第 1 天；与 config/daily.js 同口径） */
function todayIndex(totalDays) {
  const d = new Date();
  const dayOfYear = Math.floor(
    (d - new Date(d.getFullYear(), 0, 0)) / 86400000
  );
  return (dayOfYear - 1) % (totalDays || localDaily.TOTAL_DAYS);
}

module.exports = { getDays, todayIndex, localDaily };
