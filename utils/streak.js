// utils/streak.js - 连续打卡天数算法
const ONE_DAY = 24 * 60 * 60 * 1000;

/** 时间戳 → "YYYY-MM-DD"（本地时区） */
function formatDate(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 计算连续打卡天数
 * 规则：今天已打卡 → 从今天往回数；今天未打卡 → 从昨天往回数
 *      （给用户当天补救机会），遇到断档即停止（中断归零）。
 * @param {Array} records 打卡记录数组，每条含 date 字段
 */
function calcStreak(records) {
  const dates = new Set(records.map((r) => r.date));
  let anchor = Date.now();
  if (!dates.has(formatDate(anchor))) {
    anchor -= ONE_DAY; // 今天还没打卡，从昨天开始数
  }
  let streak = 0;
  while (dates.has(formatDate(anchor))) {
    streak++;
    anchor -= ONE_DAY;
  }
  return streak;
}

/**
 * 生成本月日历状态：[{ day: 1, checked: true, hasGratitude: false, date: 'YYYY-MM-DD' }, ...]
 * checked      = 当天有冥想打卡
 * hasGratitude = 当天写了感恩日记
 * 首页据此渲染三色日历：
 *   只冥想 = 抹茶绿 · 冥想+日记 = 抹茶绿底+暖驼小圆点 · 只写日记 = 暖驼色
 */
function getMonthCalendar(records, gratitudeList) {
  const dates = new Set(records.map((r) => r.date));
  const gratDates = new Set((gratitudeList || []).map((e) => e.date));
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const list = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = formatDate(new Date(year, month, i).getTime());
    list.push({
      day: i,
      date: dateStr,
      checked: dates.has(dateStr),
      hasGratitude: gratDates.has(dateStr)
    });
  }
  return list;
}

module.exports = { formatDate, calcStreak, getMonthCalendar };
