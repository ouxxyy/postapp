// Background Service Worker for PosturePenguin
// 处理定时检测、通知、摄像头管理等后台任务

let offscreenDocumentCreated = false;
let cameraReady = false;

// 创建 offscreen document
async function createOffscreenDocument() {
  if (offscreenDocumentCreated) return;

  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: "摄像头访问用于姿势检测",
    });
    offscreenDocumentCreated = true;
    console.log("Offscreen document created");
  } catch (error) {
    console.error("Failed to create offscreen document:", error);
  }
}

// 关闭 offscreen document
async function closeOffscreenDocument() {
  if (!offscreenDocumentCreated) return;

  try {
    await chrome.offscreen.closeDocument();
    offscreenDocumentCreated = false;
    cameraReady = false;
    console.log("Offscreen document closed");
  } catch (error) {
    console.error("Failed to close offscreen document:", error);
  }
}

// 初始化摄像头（供定时检测场景使用，手动检测已改为 popup 直接 getUserMedia）
// 修复竞态：先等 OFFSCREEN_READY 再发 INIT_CAMERA
async function initCamera(): Promise<boolean> {
  await createOffscreenDocument();

  return new Promise((resolve) => {
    // 给 offscreen 脚本加载预留 500 ms，再发 INIT_CAMERA
    // 生产中可改为监听 OFFSCREEN_READY 后再发，此处简化处理
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: "INIT_CAMERA" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[BG] initCamera sendMessage error:", chrome.runtime.lastError.message);
          resolve(false);
          return;
        }
        if (response === true) {
          cameraReady = true;
          resolve(true);
        } else {
          resolve(false);
        }
      });
    }, 500);
  });
}

// 捕获帧
async function captureFrame(): Promise<{
  frame: string;
  dimensions: { width: number; height: number };
} | null> {
  if (!cameraReady) return null;

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "CAPTURE_FRAME" }, (response) => {
      resolve(response);
    });
  });
}

// 初始化默认设置
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.local.get("settings");
  if (!settings.settings) {
    await chrome.storage.local.set({
      settings: {
        checkInterval: 20,
        soundEnabled: true,
        soundVolume: 0.5,
        dailyStartTime: "09:00",
        dailyEndTime: "18:00",
        isPremium: false,
      },
    });
  }

  // 创建定时检测闹钟
  const storedSettings = await chrome.storage.local.get("settings");
  if (storedSettings.settings?.checkInterval) {
    createDetectionAlarm(storedSettings.settings.checkInterval);
  }

  console.log("姿势企鹅已安装并初始化");
});

// 创建检测闹钟
function createDetectionAlarm(intervalMinutes: number) {
  chrome.alarms.create("postureCheck", {
    delayInMinutes: 1, // 首次触发延迟
    periodInMinutes: intervalMinutes,
  });
}

// 监听闹钟
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "postureCheck") {
    // 检查是否在提醒时段内
    const settings = await chrome.storage.local.get("settings");
    if (!settings.settings) return;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMin] = settings.settings.dailyStartTime
      .split(":")
      .map(Number);
    const [endHour, endMin] = settings.settings.dailyEndTime
      .split(":")
      .map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // 如果不在提醒时段内，跳过
    if (currentTime < startTime || currentTime > endTime) {
      return;
    }

    // 定时提醒：发送 Chrome 通知提示用户检查坐姿
    // 注意：自动摄像头分析需要弹窗打开，目前架构下以通知提醒为主
    chrome.notifications.create(`postureReminder-${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "🐧 姿势企鹅提醒",
      message: "是时候检查一下你的坐姿了！点击扩展图标 → 手动检测，立即进行姿势分析。",
      priority: 2,
    });

    // 如果摄像头已经就绪（popup 在运行中），尝试发起检测
    if (cameraReady) {
      try {
        const frameData = await captureFrame();
        if (frameData) {
          chrome.runtime.sendMessage({
            type: "FRAME_FOR_DETECTION",
            frame: frameData.frame,
            dimensions: frameData.dimensions,
          });
        }
      } catch {
        console.log("摄像头分析失败，以通知提醒代替");
      }
    }
  }
});


// 监听来自 popup/content/offscreen 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Offscreen document 消息
  if (message.type === "OFFSCREEN_READY") {
    console.log("Offscreen document ready");
    return false;
  }

  if (message.type === "CAMERA_READY") {
    cameraReady = message.success;
    console.log("Camera ready:", message.success, message.error || "");
    return false;
  }

  if (message.type === "FRAME_CAPTURED") {
    // 转发给 popup 进行处理
    chrome.runtime.sendMessage({
      type: "FRAME_FOR_DETECTION",
      frame: message.frame,
      dimensions: message.dimensions,
    });
    return false;
  }

  // Popup 消息
  if (message.type === "START_DETECTION") {
    // 「开始检测」= 启用定时提醒模式
    // 不再打开 offscreen 摄像头，只创建定时闹钟
    console.log("[BG] 启用定时姿势提醒");
    chrome.storage.local.get("settings").then((result) => {
      const interval = result.settings?.checkInterval ?? 20;
      createDetectionAlarm(interval);
    });
    sendResponse({ success: true });
    return false;
  }

  if (message.type === "STOP_DETECTION") {
    // 「停止检测」= 关闭定时提醒
    console.log("[BG] 关闭定时姿势提醒");
    chrome.alarms.clear("postureCheck");
    sendResponse({ success: true });
    return false;
  }

  // INIT_CAMERA_REQUEST 和 CAPTURE_FRAME_REQUEST 已废弃：
  // 手动检测改为 DetectionPage 直接 getUserMedia，不再经过 offscreen

  if (message.type === "UPDATE_INTERVAL") {
    createDetectionAlarm(message.interval);
    return false;
  }

  if (message.type === "SHOW_NOTIFICATION") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "姿势企鹅提醒",
      message: message.message,
      priority: 2,
    });
    return false;
  }

  return false;
});

// 清理旧的记录数据（保留90天）
chrome.alarms.create("cleanupOldData", {
  periodInMinutes: 24 * 60, // 每天清理一次
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "cleanupOldData") {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const allKeys = await chrome.storage.local.get(null);
    const keysToRemove: string[] = [];

    for (const key of Object.keys(allKeys)) {
      if (key.startsWith("records_")) {
        const dateStr = key.replace("records_", "");
        const recordDate = new Date(dateStr);
        if (recordDate < ninetyDaysAgo) {
          keysToRemove.push(key);
        }
      }
    }

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log(`清理了 ${keysToRemove.length} 天的旧数据`);
    }
  }
});

export {};
