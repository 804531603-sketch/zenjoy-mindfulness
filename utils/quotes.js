// utils/quotes.js - 每日禅语库（占位版）
// 请替换为你自己的原创短句。
// 开源版不包含原作者的禅语内容。
const QUOTES = [
  '此刻安然，即是归处。',
  '呼吸是你随身携带的安宁。',
  '放慢一点，心才跟得上。'
];

/** 按日期取今日禅语（同一天稳定、隔天变化） */
function getDailyQuote(ts) {
  const d = new Date(ts || Date.now());
  const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

module.exports = { getDailyQuote, QUOTES };
