// services/playlist.js - 曲目清单（本地为骨架 · 云端按 id 热更新音乐 · 0 费用）
// 原理：曲目骨架（3 首音乐 + 10 篇本地人声）以打包版 config/tracks.js 为唯一基准；
//       小程序启动时静默拉取云端 playlist.json，仅按 id 更新【音乐】的字段
//       （换音源/改标题无需提审）。
// 铁律（2026-09-24 修复真机无声）：
//   · 本地人声（local:true，包内路径）永不被云端覆盖 —— 保证离线必响；
//   · 云端多出的曲目（如已下架音乐）一律不采纳 —— 曲目集合永远等于打包骨架。
// 容错：网络拉不到 / 格式异常 → 直接用本地打包版，功能永不中断。
// 流量：清单只有几 KB；成功后缓存到 storage，下次先用缓存再静默更新。
const HOST = require('../config/host');
const localTracks = require('../config/tracks');

const CACHE_KEY = 'cloud_playlist_v2';
const MANIFEST_URL = HOST + '/playlist.json';

/** 简单校验：清单必须是数组且每轨有 id/name/url */
function validTracks(list) {
  return Array.isArray(list) && list.length > 0 &&
    list.every((t) => t && t.id && t.name && typeof t.url === 'string');
}

/**
 * 以本地骨架为基准合流云端清单：
 *   · 本地人声（local）原样保留，云端动不了；
 *   · 音乐轨：云端存在同 id 时，用云端字段热更新（url/name/desc/cover/license）；
 *   · 云端独有的 id 直接忽略，不新增进列表。
 * @returns {Array} 合流后的曲目（始终是本地骨架的同序同集合）
 */
function mergeCloud(cloudList) {
  const cloudById = {};
  (cloudList || []).forEach((t) => { cloudById[t.id] = t; });
  return localTracks.map((base) => {
    if (base.noLoop) return base;           // 人声引导：永不覆盖（保持 https 直链与 noLoop）
    const c = cloudById[base.id];
    if (!c) return base;                    // 云端没有：保持本地
    // 音乐：按 id 用云端字段热更新（保留 local/noLoop 等本地标记）
    return Object.assign({}, base, {
      name: c.name || base.name,
      desc: c.desc || base.desc,
      url: c.url || base.url,
      cover: c.cover || base.cover,
      license: c.license || base.license
    });
  });
}

/** 读取本地缓存的清单（无则 null） */
function readCache() {
  try {
    const raw = wx.getStorageSync(CACHE_KEY);
    if (raw && raw.tracks && validTracks(raw.tracks)) return raw;
  } catch (e) {}
  return null;
}

/**
 * 获取曲目列表（回调式，兼容各基础库）
 * @param {Function} cb (tracks) —— 可能回调 1~2 次，永远至少一次，永不失败
 *   第一次：缓存（二次启动秒出）或本地打包版（首次启动也秒出）；
 *   第二次：云端有更新时，静默刷新界面。
 */
function getTracks(cb) {
  // 1. 立即给内容：缓存优先，没缓存用本地打包版 —— 界面永不空白
  const cached = readCache();
  cb(cached ? cached.tracks : localTracks);

  // 2. 静默拉云端：以本地骨架合流，版本有变化才更新缓存 + 回调刷新界面
  wx.request({
    url: MANIFEST_URL + '?t=' + Date.now(),
    method: 'GET',
    dataType: 'json',
    timeout: 8000,
    success: (res) => {
      const body = res && res.data;
      if (res.statusCode === 200 && body && validTracks(body.tracks)) {
        const merged = mergeCloud(body.tracks);
        // 用合流结果的稳定指纹判断是否真有变化（url/name 变更才刷新）
        const sig = merged.map((t) => t.id + '=' + t.url).join('|');
        const oldSig = cached ? cached.tracks.map((t) => t.id + '=' + t.url).join('|') : '';
        if (sig === oldSig) return;         // 内容没变，无需刷新
        const out = { rev: body.rev || Date.now(), tracks: merged };
        try { wx.setStorageSync(CACHE_KEY, out); } catch (e) {}
        cb(merged);
      }
      // 拉到的内容无效：保留现状，静默忽略
    }
    // 网络失败：不做任何事，界面保持第一步的内容
  });
}

module.exports = { getTracks, localTracks, mergeCloud };
