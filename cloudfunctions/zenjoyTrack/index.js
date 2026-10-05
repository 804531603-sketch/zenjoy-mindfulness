// cloudfunctions/zenjoyTrack/index.js - 访客埋点（访问 / 打卡 / 留资）
//
// 部署：本目录右键 → 「上传并部署：云端安装依赖」
//
// 三个动作：
//   action = 'visit'    小程序启动时记录一次访问（谁来了、来了几次）
//   action = 'checkin'  打卡成功时累加打卡次数
//   action = 'lead'     用户主动留下联系方式（只有这一条能把匿名访客变成可触达的人）
//
// 隐私边界（重要，别越线）：
//   只存微信自动下发的 openid，不采集昵称、头像、手机号、设备信息。
//   openid 无法反查真人身份，合规无风险；联系方式必须是用户手填自愿提交。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const VISITORS = 'zenjoy_visitors';
const LEADS = 'zenjoy_leads';

/** 取（没有则建）该用户的访客档案。云函数写入不会自动带 _openid，必须显式写 */
async function ensureVisitor(openid, now) {
  const res = await db.collection(VISITORS).where({ _openid: openid }).limit(1).get();
  if (res.data && res.data.length) return res.data[0];
  const doc = {
    _openid: openid,
    firstAt: now,
    lastAt: now,
    visits: 0,
    checkins: 0,
    lead: false,
    scene: 0
  };
  const added = await db.collection(VISITORS).add({ data: doc });
  return Object.assign({ _id: added._id }, doc);
}

exports.main = async (event = {}) => {
  const ctx = cloud.getWXContext();
  const openid = ctx.OPENID;
  if (!openid) return { ok: false, err: 'no_openid' };

  const now = Date.now();
  const action = event.action || 'visit';

  try {
    const doc = await ensureVisitor(openid, now);

    if (action === 'checkin') {
      // 先在 update 之前算好返回值：doc 可能与数据库行共享引用，
      // update 之后再读 doc 会拿到已经 inc 过的值，凭空多算一次。
      const nextCheckins = (doc.checkins || 0) + 1;
      await db.collection(VISITORS).doc(doc._id).update({
        data: {
          checkins: _.inc(1),
          lastCheckinAt: now,
          lastDate: String(event.date || ''),
          lastAt: now
        }
      });
      return { ok: true, checkins: nextCheckins };
    }

    if (action === 'lead') {
      const contact = String(event.contact || '').trim();
      if (!contact) return { ok: false, err: 'empty' };
      if (contact.length > 60) return { ok: false, err: 'too_long' };
      await db.collection(LEADS).add({
        data: {
          _openid: openid,
          contact: contact,
          source: String(event.source || 'unknown'),
          createdAt: now
        }
      });
      await db.collection(VISITORS).doc(doc._id).update({
        data: { lead: true, leadAt: now, lastAt: now }
      });
      return { ok: true };
    }

    // 默认：记录一次访问
    // 同样在 update 之前锁死返回值，不依赖副作用执行顺序
    const isNew = !doc.visits;
    const nextVisits = (doc.visits || 0) + 1;
    const curCheckins = doc.checkins || 0;
    const curLead = !!doc.lead;
    await db.collection(VISITORS).doc(doc._id).update({
      data: {
        lastAt: now,
        visits: _.inc(1),
        scene: Number(event.scene || 0) || 0
      }
    });
    return {
      ok: true,
      isNew: isNew,
      visits: nextVisits,
      checkins: curCheckins,
      hasLead: curLead
    };
  } catch (e) {
    return { ok: false, err: String((e && e.message) || e) };
  }
};
