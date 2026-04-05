(() => {
  "use strict";
  function e(e) {
    chrome.alarms.create("postureCheck", {
      delayInMinutes: 1,
      periodInMinutes: e,
    });
  }
  (chrome.runtime.onInstalled.addListener(async () => {
    (await chrome.storage.local.get("settings")).settings ||
      (await chrome.storage.local.set({
        settings: {
          checkInterval: 20,
          soundEnabled: !0,
          soundVolume: 0.5,
          dailyStartTime: "09:00",
          dailyEndTime: "18:00",
          isPremium: !1,
        },
      }));
    const t = await chrome.storage.local.get("settings");
    (t.settings?.checkInterval && e(t.settings.checkInterval),
      console.log("姿势企鹅已安装并初始化"));
  }),
    chrome.alarms.onAlarm.addListener(async (e) => {
      if ("postureCheck" === e.name) {
        const e = await chrome.storage.local.get("settings");
        if (!e.settings) return;
        const t = new Date(),
          a = 60 * t.getHours() + t.getMinutes(),
          [s, n] = e.settings.dailyStartTime.split(":").map(Number),
          [o, r] = e.settings.dailyEndTime.split(":").map(Number);
        if (a < 60 * s + n || a > 60 * o + r) return;
        const [i] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
        if (i?.id)
          try {
            await chrome.tabs.sendMessage(i.id, { type: "PERFORM_CHECK" });
          } catch {
            console.log("Content script not available on this tab");
          }
      }
    }),
    chrome.runtime.onMessage.addListener((t, a, s) =>
      "START_DETECTION" === t.type
        ? (console.log("开始姿势检测"), !0)
        : "STOP_DETECTION" === t.type
          ? (console.log("停止姿势检测"), !0)
          : "UPDATE_INTERVAL" === t.type
            ? (e(t.interval), !0)
            : "SHOW_NOTIFICATION" === t.type &&
              (chrome.notifications.create({
                type: "basic",
                iconUrl: "icons/icon128.png",
                title: "姿势企鹅提醒",
                message: t.message,
                priority: 2,
              }),
              !0),
    ),
    chrome.alarms.create("cleanupOldData", { periodInMinutes: 1440 }),
    chrome.alarms.onAlarm.addListener(async (e) => {
      if ("cleanupOldData" === e.name) {
        const e = new Date();
        e.setDate(e.getDate() - 90);
        const t = await chrome.storage.local.get(null),
          a = [];
        for (const s of Object.keys(t))
          if (s.startsWith("records_")) {
            const t = s.replace("records_", "");
            new Date(t) < e && a.push(s);
          }
        a.length > 0 &&
          (await chrome.storage.local.remove(a),
          console.log(`清理了 ${a.length} 天的旧数据`));
      }
    }));
})();
