// services/audio-manager.js - 单引擎音频门面（v7 · 全 InnerAudio · 静音也出声）
//
// 2026-09-24 修复 iPhone 真机"无声音"最终版：
//   · 实测：人声走 InnerAudioContext 已验证有声；
//     音乐原走 BackgroundAudioManager，受手机静音键控制 → 静音时无声。
//   → 终局：人声 + 音乐 统一用 InnerAudioContext，obeyMuteSwitch=false
//     （手机静音键开启也照常出声），彻底解决"音乐没声"。
//   · 人声（noLoop）播完即止；音乐（非 noLoop）播完自动循环当前曲（定时到点停止）。
//   · 音频源：track.fileID 优先（微信云存储，免白名单），否则 track.url（https 直链，已验证可用）。
//   · 人声首播后后台 wx.downloadFile 缓存到手机（需 downloadFile 合法域名），之后离线可听；
//     缓存失败不影响本次播放。
//
// 对外接口与旧版完全一致，页面零改动（meditate.js 仍通过 audioManager.bgm facade 绑进度条）。

const inner = wx.createInnerAudioContext();

// 静音键开启也出声（冥想/疗愈常静音），并与其他声音混音
if (wx.setInnerAudioOption) {
  try { wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true }); } catch (e) {}
}

let stopAt = 0;                 // 定时停止时间点（时间戳），0=不定时
let currentTrack = null;        // 当前音轨
let currentIndex = -1;          // 当前索引
let playlist = [];              // 完整曲目列表

// 统一回调
const statusCbs = [];
const loadingCbs = [];
const progressCbs = [];
const trackChangeCbs = [];
const timeUpdateCbs = [];
const waitingCbs = [];
const canplayCbs = [];

let loadingOn = false;
let lastProgress = -1;

function emit(list, arg) { list.slice().forEach((f) => { try { f(arg); } catch (e) {} }); }
function notifyPlaying(on) { emit(statusCbs, on); }
function notifyLoading(on) {
  if (loadingOn === on) return;
  loadingOn = on;
  emit(loadingCbs, on);
}
function notifyProgress(pct) {
  if (pct === lastProgress) return;
  lastProgress = pct;
  emit(progressCbs, pct);
}
function notifyTrackChange(track) { emit(trackChangeCbs, track); }

let dbg = { engine: 'inner', src: '-', err: '-' };

// ---------- 本地缓存（人声离线复播）----------
const CACHE_PREFIX = 'zenjoy_ac_';
const memCache = {};
function getCache(track) {
  if (memCache[track.url]) return memCache[track.url];
  try {
    const p = wx.getStorageSync(CACHE_PREFIX + track.id);
    if (p) { memCache[track.url] = p; return p; }
  } catch (e) {}
  return '';
}
function cacheInBackground(track, done) {
  const fin = typeof done === 'function' ? done : function () {};
  if (getCache(track)) return fin();
  if (!wx.downloadFile) return fin();
  wx.downloadFile({
    url: track.fileID || track.url,
    success: (res) => {
      if (!res || res.statusCode !== 200 || !res.tempFilePath) return fin();
      const fs = wx.getFileSystemManager ? wx.getFileSystemManager() : null;
      const persist = (saved) => {
        memCache[track.url] = saved;
        try { wx.setStorageSync(CACHE_PREFIX + track.id, saved); } catch (e) {}
        fin();
      };
      if (fs && fs.saveFile) {
        fs.saveFile({ tempFilePath: res.tempFilePath, success: (r) => persist(r.savedFilePath), fail: () => persist(res.tempFilePath) });
      } else {
        persist(res.tempFilePath);
      }
    },
    fail: (res) => {
      const msg = res && res.errMsg ? res.errMsg : 'fail';
      dbg.err = 'dl:' + msg;   // 缓存失败原因（域名白名单/网络），不影响本次播放
      fin();
    }
  });
}

// ---------- 引擎事件绑定（统一 InnerAudio）----------
inner.onPlay(() => { notifyLoading(false); notifyProgress(100); notifyPlaying(true); });
inner.onPause(() => { notifyPlaying(false); });
inner.onStop(() => { notifyPlaying(false); });
inner.onWaiting(() => { notifyLoading(true); emit(waitingCbs); });
inner.onCanplay(() => { notifyLoading(false); emit(canplayCbs); });
inner.onTimeUpdate(() => { checkTimer(); emit(timeUpdateCbs); });
inner.onError((e) => {
  dbg.err = String(e && (e.errMsg || e.errorMessage) ? (e.errMsg || e.errorMessage) : JSON.stringify(e));
  notifyLoading(false);
});
// 播完处理：人声止，音乐循环当前曲（定时到点由 checkTimer 拦截）
inner.onEnded(() => {
  if (!currentTrack) return;
  if (currentTrack.noLoop) { notifyPlaying(false); return; }
  // 音乐：循环重播（src 仍在，直接 play）
  try { inner.play(); } catch (e) {}
});

// ---------- 定时停止 ----------
function checkTimer() {
  if (stopAt && Date.now() >= stopAt) {
    stopAt = 0;
    try { inner.pause(); } catch (e) {}
    notifyPlaying(false);
  }
}

// ---------- 切歌 ----------
function indexOfTrack(track) { return playlist.findIndex((t) => t.id === track.id); }
function stepTrack(dir) {
  if (!playlist.length) return;
  let idx = currentIndex < 0 ? (dir > 0 ? -1 : 0) : currentIndex;
  for (let step = 0; step < playlist.length; step++) {
    idx = (idx + dir + playlist.length) % playlist.length;
    const t = playlist[idx];
    if (t.url || t.fileID) { play(t); return; }
  }
}

// ---------- 播放 ----------
function play(track) {
  if (!track || !(track.url || track.fileID)) return;
  currentTrack = track;
  const idx = indexOfTrack(track);
  if (idx >= 0) currentIndex = idx;

  dbg = { engine: 'inner', src: track.fileID || track.url, err: '-' };
  notifyTrackChange(track);
  notifyLoading(true);
  notifyProgress(0);

  const cached = getCache(track);
  inner.src = cached || track.fileID || track.url;
  inner.play();
  cacheInBackground(track);
}

function pause() { try { inner.pause(); } catch (e) {} }
function resume() { try { inner.play(); } catch (e) {} }
function stop() {
  stopAt = 0;
  currentTrack = null;
  notifyLoading(false);
  try { inner.stop(); } catch (e) {}
}
function seek(seconds) { try { inner.seek(seconds); } catch (e) {} }

function setTimer(minutes) { stopAt = minutes > 0 ? Date.now() + minutes * 60 * 1000 : 0; }
function getTimerRemainSec() { if (!stopAt) return -1; return Math.max(0, Math.round((stopAt - Date.now()) / 1000)); }

function isPlaying() { return !inner.paused && !!inner.src; }
function getCurrentTrack() { return currentTrack; }

function getDebugInfo() {
  return [
    'BUILD=1523',
    'engine=inner',
    'track=' + (currentTrack ? currentTrack.id : '-'),
    'src=' + (inner.src || '-'),
    'err=' + (dbg.err || '-')
  ].join('\n');
}

// ---------- 对外注册式监听 ----------
function subscribe(list, cb) {
  if (typeof cb !== 'function') return function () {};
  list.push(cb);
  return () => { const i = list.indexOf(cb); if (i >= 0) list.splice(i, 1); };
}
function onStatusChange(cb) { return subscribe(statusCbs, cb); }
function onLoadingChange(cb) { return subscribe(loadingCbs, cb); }
function onDownloadProgress(cb) { return subscribe(progressCbs, cb); }
function onTrackChange(cb) { return subscribe(trackChangeCbs, cb); }

// meditate.js 通过 facade 绑进度条/缓冲提示（包装同一 inner）
const facade = {
  get src() { return inner.src || ''; },
  get currentTime() { return inner.currentTime || 0; },
  get duration() { return inner.duration || 0; },
  onTimeUpdate(cb) { return subscribe(timeUpdateCbs, cb); },
  offTimeUpdate(cb) { const i = timeUpdateCbs.indexOf(cb); if (i >= 0) timeUpdateCbs.splice(i, 1); },
  onWaiting(cb) { return subscribe(waitingCbs, cb); },
  offWaiting(cb) { const i = waitingCbs.indexOf(cb); if (i >= 0) waitingCbs.splice(i, 1); },
  onCanplay(cb) { return subscribe(canplayCbs, cb); },
  offCanplay(cb) { const i = canplayCbs.indexOf(cb); if (i >= 0) canplayCbs.splice(i, 1); }
};

// ---------- 预载 ----------
let voicePrefetched = false;
function prefetchVoicePkgs(list) {
  if (voicePrefetched) return;
  voicePrefetched = true;
  const voices = (list || []).filter((t) => t.noLoop && (t.url || t.fileID)).filter((t) => !getCache(t));
  if (!voices.length) return;
  wx.getNetworkType({
    success: (n) => {
      if (!n || n.networkType !== 'wifi') return;
      let i = 0;
      const next = () => { if (i >= voices.length) return; cacheInBackground(voices[i++], () => setTimeout(next, 300)); };
      next();
    },
    fail: () => {}
  });
}
function prefetchTracks() {}

function setPlaylist(tracks) { playlist = Array.isArray(tracks) ? tracks : []; }

module.exports = {
  bgm: facade,
  setPlaylist,
  play,
  playNext: () => stepTrack(1),
  playPrev: () => stepTrack(-1),
  pause,
  resume,
  stop,
  seek,
  setTimer,
  getTimerRemainSec,
  onStatusChange,
  onLoadingChange,
  onDownloadProgress,
  onTrackChange,
  isPlaying,
  getCurrentTrack,
  getDebugInfo,
  prefetchTracks,
  prefetchVoicePkgs
};
