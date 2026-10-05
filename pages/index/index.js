// pages/index/index.js - 首页：打卡进度 + 徽章墙 + 开始冥想 + 海报
const storage = require('../../utils/storage');
const streak = require('../../utils/streak');
const badges = require('../../utils/badges');
const quotes = require('../../utils/quotes');
const seasons = require('../../utils/seasons');
const cloud = require('../../utils/cloud');
const visitor = require('../../utils/visitor');
const gratitude = require('../../utils/gratitude');
const dailyService = require('../../services/daily');
const { formatDate } = streak;

const app = getApp();

// 心情选项（与内容底线一致：温暖、不评判）
const MOODS = ['平静', '放松', '安稳', '清明', '有些累', '想哭'];

Page({
  data: {
    todayText: '',
    streakDays: 0,
    totalDays: 0,
    checkedToday: false,
    monthCheckedCount: 0,
    monthDays: 30,
    calendar: [],
    totalMinutes: 0,
    // 徽章
    badgeWall: [],
    nextBadge: null,
    // 打卡弹窗
    showModal: false,
    pendingDuration: 0,
    moods: MOODS,
    moodIndex: -1,
    note: '',
    // 里程碑解锁祝贺
    showBadgeModal: false,
    newBadge: null,
    // 海报
    showPoster: false,
    posterUrl: '',
    posterSaving: false,
    // 打卡提醒订阅消息模板 ID（姐姐在小程序后台创建后填入；为空则不弹授权）
    remindTemplateId: '',
    // 开屏疗愈海报（冷启动展示约 3 秒后淡出；不喜欢可整体移除）
    showSplash: true,
    splashLeaving: false,
    splashQuote: '',
    // 节气/节日特别标识（如「白露 · 节气」「中秋节」）；无则为空，只显示每日禅语
    splashTag: '',
    // 静坐之后的引路弹窗（打卡成功后：今日一练没做→引导去做；做过了→邀请写感恩日记）
    showAfterModal: false,
    afterDailyPending: true,
    // 日历点按查看当日详情（打卡 + 感恩日记）
    dayDetail: null,
    // 每日陪伴（今日一思 + 今日一练）
    dailyItem: null,      // { day, title, thought }
    dailyPracticeDone: false
  },

  onLoad() {
    // 开屏海报：默认今日禅语；当天是节气/节日则换特别版寄语并显示节日标签
    const special = seasons.getSpecialContent();
    this.setData({
      splashQuote: special ? special.quote : quotes.getDailyQuote(),
      splashTag: special ? special.tag : ''
    });
    this._splashT1 = setTimeout(() => this.setData({ splashLeaving: true }), 2600);
    this._splashT2 = setTimeout(() => this.setData({ showSplash: false }), 3050);
  },

  onUnload() {
    if (this._splashT1) clearTimeout(this._splashT1);
    if (this._splashT2) clearTimeout(this._splashT2);
    if (this._afterTimer) clearTimeout(this._afterTimer);
  },

  onShow() {
    // 每次回到首页（含冥想结束返回）都刷新进度
    this.refresh();
    this.refreshDaily();
    // 中途离开冥想的补打卡：静坐成果不丢，温柔询问要不要补上
    this.checkPendingCheckin();
  },

  /** 检测是否有未完成的打卡（中途按返回离开冥想页时暂存的时长） */
  checkPendingCheckin() {
    const pending = app.globalData.pendingCheckin;
    if (!pending || this.data.showModal) return;
    app.globalData.pendingCheckin = null;
    // 如果今天已经打过卡，不再打扰
    if (storage.getRecords().some((r) => r.date === formatDate(Date.now()))) return;
    // 延迟一点，等页面渲染稳定后再弹，避免和打卡成功窗打架
    setTimeout(() => {
      if (this.data.showModal || this.data.showAfterModal) return;
      this.setData({ showModal: true, pendingDuration: pending.duration });
    }, 600);
  },

  refresh() {
    const localRecords = storage.getRecords();
    // 云同步：拉取云端记录与本地合并（未开通云开发时直接用本地）
    cloud.pullAndMerge(localRecords, (merged) => {
      if (merged.length !== localRecords.length) {
        // 云端有本地没有的记录，写回本地（保持本地为权威副本）
        storage.replaceAll(merged);
      }
      this.renderWith(merged);
    });
  },

  /** 每日陪伴：取今天这一天的标题预览 + 练习完成状态（秒出，永不空白） */
  refreshDaily() {
    dailyService.getDays((days) => {
      const idx = dailyService.todayIndex(days.length);
      const d = days[idx];
      if (!d) return;
      let done = false;
      try {
        const doneMap = wx.getStorageSync('daily_practice_done') || {};
        done = !!doneMap[formatDate(Date.now())];
      } catch (e) {}
      this.setData({
        dailyItem: { day: idx + 1, title: d.title },
        dailyPracticeDone: done
      });
    });
  },

  /** 进入每日陪伴页 */
  onGoDaily() {
    wx.navigateTo({ url: '/pages/daily/daily' });
  },

  renderWith(records) {
    const now = new Date();

    const weekText = ['日', '一', '二', '三', '四', '五', '六'];
    const todayText = `${now.getMonth() + 1}月${now.getDate()}日 · 星期${weekText[now.getDay()]}`;

    // 三色日历：冥想记录 + 感恩日记记录合并渲染
    const calendar = streak.getMonthCalendar(records, gratitude.getAll());
    // 给今天的格子加标记，便于首页高亮
    const today = now.getDate();
    calendar.forEach((d) => {
      if (d.day === today) d.isToday = true;
    });
    const monthCheckedCount = calendar.filter((d) => d.checked).length;
    const totalMinutes = records.reduce((sum, r) => sum + (r.duration || 0), 0);
    const streakDays = streak.calcStreak(records);
    const totalDays = records.length;
    const checkedToday = records.some((r) => r.date === formatDate(Date.now()));

    this.setData({
      todayText,
      streakDays,
      totalDays,
      checkedToday,
      calendar,
      monthCheckedCount,
      monthDays: calendar.length,
      totalMinutes,
      badgeWall: badges.getBadgeWall(totalDays),
      nextBadge: badges.getNext(totalDays)
    });
  },

  onStartMeditation() {
    app.globalData.sessionStart = Date.now();
    app.globalData.inSession = true;
    wx.navigateTo({ url: '/pages/meditate/meditate' });
  },

  // ---------- 日历：点按某天查看当日记录（冥想 + 感恩日记） ----------
  onTapCalendarDay(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;
    const { checked, hasGratitude, date } = item;
    // 没有任何记录的普通日子：轻提示，不弹窗打扰
    if (!checked && !hasGratitude) {
      wx.showToast({ title: '这一天还没有记录', icon: 'none' });
      return;
    }
    // 冥想打卡记录（时长 + 心情 + 随笔）
    let record = null;
    if (checked) {
      record = storage.getRecords().find((r) => r.date === date) || null;
    }
    // 感恩日记内容
    const gratText = hasGratitude ? gratitude.getByDate(date) : '';
    this.setData({
      dayDetail: {
        dateText: gratitude.displayDate(date),
        checked,
        hasGratitude,
        duration: record ? record.duration : 0,
        mood: record ? record.mood || '' : '',
        note: record ? record.note || '' : '',
        gratText
      }
    });
  },

  onCloseDayDetail() {
    this.setData({ dayDetail: null });
  },

  // 跳转到关于页（音源署名与免责说明）
  onGoAbout() {
    wx.navigateTo({ url: '/pages/about/about' });
  },

  // 冥想页结束时回调：弹出打卡弹窗
  onMeditationFinished({ duration }) {
    this.setData({ showModal: true, pendingDuration: duration });
  },

  onSelectMood(e) {
    this.setData({ moodIndex: Number(e.currentTarget.dataset.index) });
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value });
  },

  onConfirmCheckin() {
    const { pendingDuration, moodIndex, note, moods } = this.data;
    const record = {
      date: formatDate(Date.now()),
      duration: pendingDuration,
      mood: moodIndex >= 0 ? moods[moodIndex] : '',
      note: note.trim(),
      ts: Date.now()
    };
    const ok = storage.addRecord(record);
    if (!ok) {
      wx.showToast({ title: '今天已经打过卡啦', icon: 'none' });
      this.setData({ showModal: false, moodIndex: -1, note: '', pendingDuration: 0 });
      this.refresh();
      return;
    }
    // 云同步：上传这条记录（未开通云开发时自动跳过，不影响打卡）
    cloud.uploadRecord(record);
    // 顺带请求一次打卡提醒的订阅授权（用户拒绝也不打扰）
    this.requestRemindAuth();

    wx.showToast({ title: `打卡成功 · ${pendingDuration} 分钟`, icon: 'none' });
    // 轻触感反馈：打卡成功时手机轻震一下（不支持的机型自动忽略）
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light', fail: () => {} });
    }
    this.setData({ showModal: false, moodIndex: -1, note: '', pendingDuration: 0 });
    this.refresh();

    // 静坐之后的温柔引路：看看今天的「每日陪伴·一练」做了没，
    // 没做就顺着这份安静引导去做；做过了则邀请写感恩日记。自愿，可跳过。
    let dailyPending = true;
    try {
      const doneMap = wx.getStorageSync('daily_practice_done') || {};
      dailyPending = !doneMap[formatDate(Date.now())];
    } catch (e) {}
    this._afterTimer = setTimeout(() => {
      this.setData({ showAfterModal: true, afterDailyPending: dailyPending });
    }, 900);

    // 里程碑检测：按累计打卡天数解锁（中断不夺走徽章），可能一次解锁多枚
    const newTotal = storage.getRecords().length;
    const hits = badges.checkUnlock(newTotal);
    if (hits.length) {
      this.setData({ showBadgeModal: true, newBadge: hits[hits.length - 1] });
      // 解锁里程碑：比打卡稍强的轻震（不支持的机型自动忽略）
      if (wx.vibrateShort) {
        wx.vibrateShort({ type: 'medium', fail: () => {} });
      }
    }
  },

  // ---------- 静坐之后的引路弹窗（打卡成功后出现，自愿选择） ----------
  // 去做今天的每日陪伴·一练（今日一练没做时优先引导）
  onGoDailyPractice() {
    this.setData({ showAfterModal: false });
    this.maybeShowLead();
    wx.navigateTo({ url: '/pages/daily/daily' });
  },
  // 去写感恩日记
  onGoGratitude() {
    this.setData({ showAfterModal: false });
    this.maybeShowLead();
    wx.navigateTo({ url: '/pages/gratitude/gratitude' });
  },
  // 暂时都不做（自愿原则，不挽留）
  onSkipAfter() {
    this.setData({ showAfterModal: false });
    this.maybeShowLead();
  },

  // ---------- 留资邀请（7 天正念音频） ----------
  // 触发条件：累计打卡满 3 天 + 从未留过 + 今天没邀请过。
  // 新朋友第一天就弹窗要微信，是不体面的；先给价值，再开口。
  maybeShowLead() {
    if (visitor.isLeadDone()) return;
    if (storage.getRecords().length < 3) return;
    const today = formatDate(Date.now());
    if (visitor.getShownDate() === today) return;
    visitor.markShownToday(today);
    setTimeout(() => this.tryNavigateLead(0), 600);
  },

  /** 等所有弹窗都关了再跳转，绝不打断别人的安静 */
  tryNavigateLead(n) {
    if (n > 5) return;
    const d = this.data;
    if (d.showModal || d.showAfterModal || d.showBadgeModal || d.showPoster || d.dayDetail) {
      setTimeout(() => this.tryNavigateLead(n + 1), 1200);
      return;
    }
    wx.navigateTo({ url: '/pages/lead/lead?source=checkin' });
  },

  // 订阅消息授权：积累提醒次数（模板 ID 配置在下方常量）
  requestRemindAuth() {
    const tplId = this.data.remindTemplateId;
    if (!tplId || !wx.requestSubscribeMessage) return;
    wx.requestSubscribeMessage({ tmplIds: [tplId], fail: () => {} });
  },

  onCloseBadgeModal() {
    this.setData({ showBadgeModal: false, newBadge: null });
  },

  onCancelModal() {
    this.setData({ showModal: false, moodIndex: -1, note: '' });
  },

  // ---------- 海报 ----------
  onShowPoster() {
    this.setData({ showPoster: true, posterUrl: '' });
    // 等 canvas 挂载后再绘制
    setTimeout(() => this.drawPoster(), 100);
  },

  onClosePoster() {
    this.setData({ showPoster: false, posterUrl: '' });
  },

  drawPoster() {
    const that = this;
    const query = wx.createSelectorQuery();
    query
      .select('#posterCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const width = res[0].width;
        const height = res[0].height;
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        // 背景：柔和奶油晨光（与全站品牌色统一）
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#F7F2EA');
        bgGrad.addColorStop(1, '#F4EEE4');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
        // 柔光晕：抹茶绿 + 暖驼淡晕（呼应开屏海报）
        const glowTop = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, height * 0.5);
        glowTop.addColorStop(0, 'rgba(126,155,119,0.12)');
        glowTop.addColorStop(1, 'rgba(126,155,119,0)');
        ctx.fillStyle = glowTop;
        ctx.fillRect(0, 0, width, height);
        const glowBottom = ctx.createRadialGradient(width / 2, height, 0, width / 2, height, height * 0.5);
        glowBottom.addColorStop(0, 'rgba(200,146,104,0.12)');
        glowBottom.addColorStop(1, 'rgba(200,146,104,0)');
        ctx.fillStyle = glowBottom;
        ctx.fillRect(0, 0, width, height);
        // 呼吸小点（固定随机种子式：用日期生成，每天不同）
        const seed = Date.now() % 1000;
        ctx.fillStyle = 'rgba(126,155,119,0.35)';
        for (let i = 0; i < 24; i++) {
          const x = ((seed * (i + 3) * 7) % 1000) / 1000 * width;
          const y = ((seed * (i + 7) * 13) % 1000) / 1000 * height;
          const r = ((i % 3) + 1) * 0.6;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        // 抹茶绿圆环（呼应呼吸环）
        ctx.strokeStyle = 'rgba(126,155,119,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(width / 2, height * 0.28, 56, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(126,155,119,0.25)';
        ctx.beginPath();
        ctx.arc(width / 2, height * 0.28, 68, 0, Math.PI * 2);
        ctx.stroke();

        const streakDays = this.data.streakDays;
        const totalMinutes = this.data.totalMinutes;

        // 品牌名
        ctx.fillStyle = '#6B8A66';
        ctx.font = '500 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('禅悦 · 正念打卡', width / 2, height * 0.28 - 60);
        // 圆环内天数
        ctx.font = '500 40px sans-serif';
        ctx.fillStyle = '#7E9B77';
        ctx.fillText(String(streakDays), width / 2, height * 0.28 + 4);
        ctx.font = '400 11px sans-serif';
        ctx.fillStyle = '#9C9184';
        ctx.fillText('连续打卡天数', width / 2, height * 0.28 + 26);
        ctx.fillText(`累计冥想 ${totalMinutes} 分钟`, width / 2, height * 0.28 + 44);

        // 今日禅语（自动换行）
        const quote = quotes.getDailyQuote();
        ctx.font = '400 14px sans-serif';
        ctx.fillStyle = '#574E42';
        const maxW = width - 80;
        let line = '';
        let lines = [];
        for (const ch of quote) {
          if (ctx.measureText(line + ch).width > maxW) {
            lines.push(line);
            line = ch;
          } else {
            line += ch;
          }
        }
        lines.push(line);
        lines = lines.slice(0, 3);
        let qy = height * 0.55;
        lines.forEach((l) => {
          ctx.fillText(l, width / 2, qy);
          qy += 22;
        });

        // 日期
        ctx.font = '400 11px sans-serif';
        ctx.fillStyle = '#9C9184';
        ctx.fillText(this.data.todayText, width / 2, height * 0.78);

        // 底部标语
        ctx.fillStyle = 'rgba(200,146,104,0.9)';
        ctx.font = '400 12px sans-serif';
        ctx.fillText('当下的人生，就是最完美的了', width / 2, height * 0.88);

        // 导出图片
        wx.canvasToTempFilePath(
          {
            canvas,
            success: (r) => that.setData({ posterUrl: r.tempFilePath }),
            fail: () => wx.showToast({ title: '海报生成失败，请重试', icon: 'none' })
          },
          that
        );
      });
  },

  onSavePoster() {
    if (!this.data.posterUrl || this.data.posterSaving) return;
    this.setData({ posterSaving: true });
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterUrl,
      success: () => {
        wx.showToast({ title: '已保存到相册，去分享吧', icon: 'none' });
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('auth') > -1) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许访问相册，才能保存海报',
            confirmText: '去设置',
            success: (r) => {
              if (r.confirm) wx.openSetting();
            }
          });
        } else {
          wx.showToast({ title: '保存失败，请重试', icon: 'none' });
        }
      },
      complete: () => this.setData({ posterSaving: false })
    });
  },

  // V1.0 预留：分享卡片（转发给好友/群）
  onShareAppMessage() {
    return {
      title: '禅悦·正念打卡 | 当下的人生，就是最完美的了',
      path: '/pages/index/index'
    };
  },

  // 分享到朋友圈（需在页面右上角菜单触发；个人主体小程序也支持）
  onShareTimeline() {
    return {
      title: '禅悦·正念打卡 | 当下的人生，就是最完美的了'
    };
  }
});
