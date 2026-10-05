// cloudfunctions/zenjoyAdmin/index.js - 管理后台数据查询
//
// 部署：本目录右键 → 「上传并部署：云端安装依赖」
// 部署后把密码改掉（下面 ADMIN_PWD），别用默认值。
//
// 为什么一定要走云函数：小程序端读数据库受「仅创建者可读写」限制，
// 你只能读到自己的记录；云函数是管理员权限，才能看到全部访客。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// ⚠️ 改成你自己的密码（字母数字都行，别带空格）
const ADMIN_PWD = '';

const VISITORS = 'zenjoy_visitors';
const LEADS = 'zenjoy_leads';
const RECORDS = 'zenjoy_records';

const TZ = 8 * 3600 * 1000; // 云函数是 UTC+0，所有时间统一按北京时间算

/** 北京时间「今天 0 点」的时间戳 */
function todayStartTs() {
  const d = new Date(Date.now() + TZ);
  return Date.parse(d.toISOString().slice(0, 10) + 'T00:00:00+08:00');
}

/** 时间戳 → 「09-07 14:30」 */
function fmt(ts) {
  if (!ts) return '-';
  const d = new Date(Number(ts) + TZ);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function tail(openid) {
  return String(openid || '').slice(-6) || '-';
}

exports.main = async (event = {}) => {
  if (String(event.pwd || '') !== ADMIN_PWD) {
    return { ok: false, err: 'pwd' };
  }

  try {
    const now = Date.now();
    const t0 = todayStartTs();
    const d7 = now - 7 * 24 * 3600 * 1000;

    const [vRes, lRes, rCnt] = await Promise.all([
      db.collection(VISITORS).orderBy('lastAt', 'desc').limit(1000).get(),
      db.collection(LEADS).orderBy('createdAt', 'desc').limit(1000).get(),
      db.collection(RECORDS).count()
    ]);

    const visitors = vRes.data || [];
    const leads = lRes.data || [];

    const stats = {
      total: visitors.length,
      todayActive: visitors.filter((v) => (v.lastAt || 0) >= t0).length,
      todayNew: visitors.filter((v) => (v.firstAt || 0) >= t0).length,
      active7: visitors.filter((v) => (v.lastAt || 0) >= d7).length,
      checkins: (rCnt && rCnt.total) || 0,
      leads: leads.length,
      rate: visitors.length ? Math.round((leads.length / visitors.length) * 100) : 0
    };

    // openid → 联系方式（一个人可能留过多次，取最近一条）
    const leadMap = {};
    leads.forEach((l) => {
      if (!leadMap[l._openid]) leadMap[l._openid] = l.contact;
    });

    const list = visitors.map((v, i) => ({
      no: visitors.length - i,
      tail: tail(v._openid),
      first: fmt(v.firstAt),
      last: fmt(v.lastAt),
      visits: v.visits || 0,
      checkins: v.checkins || 0,
      lead: leadMap[v._openid] || ''
    }));

    const leadList = leads.map((l) => ({
      contact: l.contact,
      tail: tail(l._openid),
      at: fmt(l.createdAt),
      source: l.source || ''
    }));

    return { ok: true, stats, list, leadList, updatedAt: fmt(now) };
  } catch (e) {
    return { ok: false, err: String((e && e.message) || e) };
  }
};
