// utils/badges.js - 里程碑徽章（累计打卡奖励系统）
// 设计原则：徽章由「累计打卡天数」驱动——中断不会夺走已获得的勋章，
// 温暖不施压，与产品疗愈基调一致。
const KEY_BADGES = 'zenjoy_badges';

// 里程碑定义：累计天数 + 徽章名 + 鼓励文案（温暖、不制造压力）
const MILESTONES = [
  { days: 3, name: '初心', msg: '三天之约，你已经迈出了最难的第一步。' },
  { days: 7, name: '一周圆满', msg: '七天，你已让静坐成为生活的一部分。' },
  { days: 21, name: '习惯养成', msg: '二十一天，平静正在成为你的本能。' },
  { days: 50, name: '半百之悦', msg: '五十次呼吸的约会，你从未辜负自己。' },
  { days: 100, name: '百日如一', msg: '一百天，你已与安宁深深相融。' }
];

/** 读取已解锁徽章（存解锁的里程碑天数列表） */
function getUnlocked() {
  try {
    return wx.getStorageSync(KEY_BADGES) || [];
  } catch (e) {
    return [];
  }
}

/**
 * 打卡后检测：返回本次新解锁的里程碑数组（可能一次解锁多枚）
 * @param {number} totalDays 累计打卡天数
 */
function checkUnlock(totalDays) {
  const unlocked = getUnlocked();
  const hits = MILESTONES.filter(
    (m) => totalDays >= m.days && !unlocked.includes(m.days)
  );
  if (hits.length) {
    hits.forEach((h) => unlocked.push(h.days));
    wx.setStorageSync(KEY_BADGES, unlocked);
  }
  return hits;
}

/**
 * 生成徽章墙数据：[{ name, days, msg, unlocked }]
 * @param {number} totalDays 累计打卡天数
 */
function getBadgeWall(totalDays) {
  const unlocked = getUnlocked();
  return MILESTONES.map((m) => ({
    ...m,
    unlocked: totalDays >= m.days || unlocked.includes(m.days)
  }));
}

/** 下一个未达成的里程碑（用于进度提示），全部达成返回 null */
function getNext(totalDays) {
  return MILESTONES.find((m) => totalDays < m.days) || null;
}

module.exports = { MILESTONES, getUnlocked, checkUnlock, getBadgeWall, getNext };
