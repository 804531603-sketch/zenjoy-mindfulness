// cloudfunctions/dailyRemind/index.js - 每日打卡提醒云函数
// 功能：定时触发，给已授权订阅消息的用户推送"该冥想了"提醒。
//
// 部署步骤（姐姐侧）：
// 1. 开发者工具左上角点「云开发」→ 开通（免费额度足够）
// 2. 本目录右键 → 「上传并部署：云端安装依赖」
// 3. 小程序后台 → 订阅消息 → 选用"打卡提醒"类模板，拿到模板 ID
// 4. 把模板 ID 填入下方 TEMPLATE_ID，重新部署
// 5. 云开发 → 云函数 → dailyRemind → 触发器 → 新建：
//    触发周期填  0 30 20 * * * *  （每天晚上 8:30，可自行改时间）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const TEMPLATE_ID = ''; // 订阅消息模板 ID
const REMIND_PAGE = 'pages/index/index';

exports.main = async () => {
  const db = cloud.database();
  const _ = db.command;

  // 找出：有打卡记录、但今天还没打卡的用户（需要提醒的人）
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  const all = await db.collection('zenjoy_records').limit(1000).get();
  const doneToday = new Set(
    all.data.filter((r) => r.date === todayStr).map((r) => r._openid)
  );
  const users = Array.from(new Set(all.data.map((r) => r._openid))).filter(
    (u) => !doneToday.has(u)
  );

  let success = 0;
  for (const openid of users) {
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: openid,
        templateId: TEMPLATE_ID,
        page: REMIND_PAGE,
        data: {
          thing1: { value: '给自己十分钟，回到呼吸' },
          time2: { value: `${todayStr} 20:30` }
        }
      });
      success++;
    } catch (e) {
      // 用户未授权或次数用完，静默跳过
    }
  }
  return { needRemind: users.length, sent: success };
};
