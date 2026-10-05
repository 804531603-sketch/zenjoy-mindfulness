// utils/cloud.js - 云同步适配层（自动降级）
// 已开通云开发并配置 ENV_ID 时：打卡记录同步到云端，换机不丢；
// 未开通时：所有函数静默降级为 no-op，纯本地运行不受影响。
const COLLECTION = 'zenjoy_records';

// ⚠️ 开通云开发后，把下面的空字符串换成你的云环境 ID
//    （开发者工具左上角「云开发」→ 设置 → 环境 ID，形如 zenjoy-xxxx）
// 2026-08-27 已开通（个人版·开发期免费），环境 ID 如下：
const ENV_ID = '';

/** 云开发是否可用 */
function isReady() {
  return !!(ENV_ID && wx.cloud);
}

/** 初始化（在 app.js onLaunch 调用） */
function init() {
  if (!isReady()) return;
  try {
    wx.cloud.init({ env: ENV_ID, traceUser: true });
  } catch (e) {
    // 初始化失败则保持本地模式
  }
}

/**
 * 上传一条打卡记录（打卡成功后调用，失败不影响本地打卡）
 */
function uploadRecord(record) {
  if (!isReady()) return;
  const db = wx.cloud.database();
  db.collection(COLLECTION)
    .add({ data: record })
    .catch(() => {});
}

/**
 * 拉取云端记录并与本地合并（首页 onShow 时调用）
 * 合并规则：按 date 去重，云端有本地没有的补进来。
 * @param {Array} localRecords 本地记录
 * @param {Function} onMerged 合并完成回调 (merged) => void
 */
function pullAndMerge(localRecords, onMerged) {
  if (!isReady() || typeof onMerged !== 'function') {
    onMerged && onMerged(localRecords);
    return;
  }
  const db = wx.cloud.database();
  db.collection(COLLECTION)
    .limit(100)
    .get()
    .then((res) => {
      const cloudRecords = (res.data || []).map((r) => ({
        date: r.date,
        duration: r.duration || 0,
        mood: r.mood || '',
        note: r.note || '',
        ts: r.ts || 0
      }));
      const seen = new Set(localRecords.map((r) => r.date));
      const merged = localRecords.slice();
      cloudRecords.forEach((cr) => {
        if (!seen.has(cr.date)) {
          merged.push(cr);
          seen.add(cr.date);
        }
      });
      merged.sort((a, b) => a.ts - b.ts);
      onMerged(merged);
    })
    .catch(() => onMerged(localRecords));
}

module.exports = { isReady, init, uploadRecord, pullAndMerge, ENV_ID };
