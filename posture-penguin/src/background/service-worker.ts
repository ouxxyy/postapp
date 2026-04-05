// Background Service Worker for PosturePenguin
// 处理持久化检测状态、定时调度、offscreen 摄像头与分析任务

import { getLocalDateKey } from "../lib/dateKey";

type Settings = {
  checkInterval: number;
  soundEnabled: boolean;
  soundVolume: number;
  dailyStartTime: string;
  dailyEndTime: string;
  isPremium: boolean;
};

type AnalyzePostureResponse = {
  success: boolean;
  result?: {
    score: number;
    issues: string[];
    headForward: boolean;
    hunchback: boolean;
    misaligned: boolean;
  };
  error?: string;
};

const DEFAULT_SETTINGS: Settings = {
  checkInterval: 20,
  soundEnabled: true,
  soundVolume: 0.5,
  dailyStartTime: "09:00",
  dailyEndTime: "18:00",
  isPremium: false,
};

const DETECTION_ENABLED_KEY = "detectionEnabled";
const DETECTION_ALARM = "postureCheck";
const CLEANUP_ALARM = "cleanupOldData";

let offscreenDocumentCreated = false;
let cameraReady = false;

type OffscreenStatus = {
  ready?: boolean;
  detectorReady?: boolean;
  isAnalyzing?: boolean;
  cameraReady?: boolean;
};

function broadcastDetectionState(enabled: boolean): void {
  chrome.runtime.sendMessage(
    {
      type: "DETECTION_STATE_CHANGED",
      enabled,
    },
    () => {
      void chrome.runtime.lastError;
    },
  );
}

async function sendRuntimeMessage<T>(message: unknown): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve((response ?? null) as T | null);
    });
  });
}

async function waitForOffscreenReady(
  timeoutMs: number = 8000,
): Promise<boolean> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await sendRuntimeMessage<OffscreenStatus>({
      type: "PING_OFFSCREEN",
    });

    if (response?.ready) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return false;
}

async function getOffscreenStatus(): Promise<OffscreenStatus | null> {
  return sendRuntimeMessage<OffscreenStatus>({
    type: "PING_OFFSCREEN",
  });
}

async function hasOffscreenDocument(): Promise<boolean> {
  if (!chrome.runtime.getContexts) {
    return offscreenDocumentCreated;
  }

  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL("offscreen.html")],
  });

  return contexts.length > 0;
}

// 创建 offscreen document
async function createOffscreenDocument(): Promise<boolean> {
  if (await hasOffscreenDocument()) {
    offscreenDocumentCreated = true;
    return true;
  }

  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: "摄像头访问用于姿势检测",
    });
    offscreenDocumentCreated = true;
    console.log("[BG] Offscreen document created");
    return true;
  } catch (error) {
    console.error("[BG] Failed to create offscreen document:", error);
    return false;
  }
}

// 关闭 offscreen document
async function closeOffscreenDocument(): Promise<void> {
  if (!(await hasOffscreenDocument())) {
    offscreenDocumentCreated = false;
    cameraReady = false;
    return;
  }

  try {
    await chrome.offscreen.closeDocument();
    offscreenDocumentCreated = false;
    cameraReady = false;
    console.log("[BG] Offscreen document closed");
  } catch (error) {
    console.error("[BG] Failed to close offscreen document:", error);
  }
}

// 初始化摄像头（后台自动检测使用）
async function initCamera(): Promise<boolean> {
  const created = await createOffscreenDocument();
  if (!created) {
    cameraReady = false;
    return false;
  }

  const offscreenReady = await waitForOffscreenReady();
  if (!offscreenReady) {
    cameraReady = false;
    console.warn("[BG] Offscreen document did not become ready in time");
    return false;
  }

  const response = await sendRuntimeMessage<boolean>({ type: "INIT_CAMERA" });
  cameraReady = response === true;
  return cameraReady;
}

async function prewarmDetector(): Promise<boolean> {
  const created = await createOffscreenDocument();
  if (!created) {
    return false;
  }

  const offscreenReady = await waitForOffscreenReady();
  if (!offscreenReady) {
    console.warn("[BG] Offscreen document did not become ready for prewarm");
    return false;
  }

  const status = await getOffscreenStatus();
  if (status?.detectorReady) {
    return true;
  }

  const response = await sendRuntimeMessage<{
    success: boolean;
    error?: string;
  }>({
    type: "PREWARM_DETECTOR",
  });

  if (!response?.success) {
    console.warn("[BG] Detector prewarm failed:", response?.error || "unknown");
    return false;
  }
  return true;
}

async function stopCamera(): Promise<void> {
  await sendRuntimeMessage<{ success: boolean }>({ type: "STOP_CAMERA" });
  cameraReady = false;
}

async function runOnePostureCheck(): Promise<AnalyzePostureResponse> {
  console.log("[BG] runOnePostureCheck: 创建/确认 offscreen document...");
  const created = await createOffscreenDocument();
  if (!created) {
    console.error("[BG] runOnePostureCheck: offscreen 创建失败");
    return { success: false, error: "offscreen_create_failed" };
  }

  console.log("[BG] runOnePostureCheck: 等待 offscreen 就绪...");
  const offscreenReady = await waitForOffscreenReady();
  if (!offscreenReady) {
    console.error("[BG] runOnePostureCheck: offscreen 未在超时内就绪");
    return { success: false, error: "offscreen_not_ready" };
  }

  console.log("[BG] runOnePostureCheck: 发送 ANALYZE_POSTURE 消息...");
  const response = await sendRuntimeMessage<AnalyzePostureResponse>({
    type: "ANALYZE_POSTURE",
  });

  if (!response) {
    console.error("[BG] runOnePostureCheck: offscreen 未响应");
    return { success: false, error: "offscreen 未响应" };
  }
  console.log(
    "[BG] runOnePostureCheck: 收到响应",
    response.success ? "✅" : `❌ ${response.error}`,
  );
  return response;
}

async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
}

async function isDetectionEnabled(): Promise<boolean> {
  const stored = await chrome.storage.local.get(DETECTION_ENABLED_KEY);
  return Boolean(stored[DETECTION_ENABLED_KEY]);
}

async function setDetectionEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [DETECTION_ENABLED_KEY]: enabled });
  broadcastDetectionState(enabled);
}

// 保存检测结果到 chrome.storage.local
type PostureRecord = {
  id: string;
  timestamp: number;
  score: number;
  issues: string[];
  headForward: boolean;
  hunchback: boolean;
  misaligned: boolean;
};

async function savePostureRecord(result: {
  score: number;
  issues: string[];
  headForward: boolean;
  hunchback: boolean;
  misaligned: boolean;
}): Promise<void> {
  try {
    const today = getLocalDateKey();
    const key = `records_${today}`;

    const newRecord: PostureRecord = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      score: result.score,
      issues: result.issues,
      headForward: result.headForward,
      hunchback: result.hunchback,
      misaligned: result.misaligned,
    };

    const stored = await chrome.storage.local.get(key);
    const existingRecords: PostureRecord[] = stored[key] || [];

    await chrome.storage.local.set({
      [key]: [...existingRecords, newRecord],
    });

    console.log(
      `[BG] 检测记录已保存: 评分=${result.score}, 今日检测次数=${existingRecords.length + 1}`,
    );
  } catch (error) {
    console.error("[BG] 保存检测记录失败:", error);
  }
}

// 创建检测闹钟（Promise 化，避免回调形式导致的竞争条件）
async function createDetectionAlarm(intervalMinutes: number): Promise<void> {
  const normalizedInterval = Math.max(1, intervalMinutes);

  // 检查是否已存在相同间隔的闹钟，避免不必要的 clear/create
  const existing = await chrome.alarms.get(DETECTION_ALARM);
  if (existing && existing.periodInMinutes === normalizedInterval) {
    console.log(
      `[BG] 闹钟已存在且间隔一致（${normalizedInterval}分钟），跳过重建`,
    );
    return;
  }

  // 使用 Promise 包装 clear，确保 clear 完成后再 create
  await new Promise<void>((resolve) => {
    chrome.alarms.clear(DETECTION_ALARM, () => {
      void chrome.runtime.lastError; // 忽略 alarm 不存在的错误
      resolve();
    });
  });

  chrome.alarms.create(DETECTION_ALARM, {
    delayInMinutes: normalizedInterval,
    periodInMinutes: normalizedInterval,
  });
  console.log(
    `[BG] 闹钟已创建: delay=${normalizedInterval}min, period=${normalizedInterval}min`,
  );
}

function isInsideDetectWindow(settings: Settings, now: Date): boolean {
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMin] = settings.dailyStartTime.split(":").map(Number);
  const [endHour, endMin] = settings.dailyEndTime.split(":").map(Number);
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  return currentTime >= startTime && currentTime <= endTime;
}

function notifyPostureIssue(score: number, issues: string[]): void {
  const issueText =
    issues.length > 0
      ? `问题：${issues.join("、")}`
      : "检测到姿势异常，请调整坐姿";
  chrome.notifications.create(`postureReminder-${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "🐧 姿势企鹅提醒",
    message: `当前姿势评分 ${score} 分。${issueText}`,
    priority: 2,
  });
}

function isValidDetectionResult(result: {
  score: number;
  issues: string[];
}): boolean {
  if (result.score <= 0) return false;
  if (result.issues.includes("noPoseDetected")) return false;
  if (result.issues.includes("lowConfidence")) return false;
  return true;
}

async function ensureDetectionRuntime(): Promise<void> {
  const enabled = await isDetectionEnabled();
  if (!enabled) {
    console.log("[BG] ensureDetectionRuntime: 检测未启用，清除闹钟");
    await new Promise<void>((resolve) => {
      chrome.alarms.clear(DETECTION_ALARM, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    });
    return;
  }

  const settings = await getSettings();
  console.log(
    `[BG] ensureDetectionRuntime: 检测已启用，间隔=${settings.checkInterval}分钟`,
  );
  await createDetectionAlarm(settings.checkInterval);

  // 预热模型完全异步 fire-and-forget，绝不阻塞主流程
  // alarm 触发时 offscreen 的 analyzePostureOnce() 会自行加载模型
  prewarmDetector().catch((err) => {
    console.warn(
      "[BG] ensureDetectionRuntime: 预热模型失败（不影响闹钟）:",
      err,
    );
  });
}

// 初始化默认设置
chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get([
    "settings",
    DETECTION_ENABLED_KEY,
  ]);
  const mergedSettings: Settings = {
    ...DEFAULT_SETTINGS,
    ...(stored.settings || {}),
  };

  await chrome.storage.local.set({ settings: mergedSettings });
  if (typeof stored[DETECTION_ENABLED_KEY] !== "boolean") {
    await chrome.storage.local.set({ [DETECTION_ENABLED_KEY]: false });
  }

  await ensureDetectionRuntime();
  console.log("姿势企鹅已安装并初始化");
});

chrome.runtime.onStartup.addListener(() => {
  ensureDetectionRuntime().catch((error) => {
    console.error("[BG] 恢复检测状态失败:", error);
  });
});

// ⚠️ 注意：不在模块顶层调用 ensureDetectionRuntime()！
// 之前每次 SW 唤醒都会调用，导致 alarm 被 clear + recreate，
// 与正在触发的 alarm listener 产生竞争条件。
// alarm 自带 periodInMinutes，Chrome 会自动维持周期性触发，
// 只需在 onInstalled/onStartup 时确保 alarm 存在即可。
console.log("[BG] Service Worker 启动");

// 监听闹钟
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== DETECTION_ALARM) return;
  if (!(await isDetectionEnabled())) {
    console.log("[BG] ⏰ 闹钟触发但检测未启用，跳过");
    return;
  }

  const settings = await getSettings();
  const now = new Date();
  if (!isInsideDetectWindow(settings, now)) {
    console.log(
      `[BG] ⏰ 当前时间 ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")} 不在检测窗口 ${settings.dailyStartTime}~${settings.dailyEndTime} 内，跳过`,
    );
    return;
  }

  console.log("[BG] ⏰ 定时检测触发，开始执行姿势检测...");

  // 直接调用 runOnePostureCheck —— offscreen 的 analyzePostureOnce()
  // 内部已经自管理摄像头（开→用→关）和模型加载，不需要 background 代劳。
  // 之前的做法是先 initCamera() + prewarmDetector()，但 Service Worker
  // 重启后内存变量 cameraReady 重置为 false，且与 offscreen 内部状态冲突，
  // 导致链路在前置检查阶段就提前返回。
  const response = await runOnePostureCheck();

  if (!response.success || !response.result) {
    const errorMsg = response.error || "unknown";
    console.warn("[BG] 自动姿势检测失败:", errorMsg);

    // 如果是摄像头/offscreen 创建问题，通知用户
    if (
      errorMsg.includes("camera") ||
      errorMsg.includes("offscreen") ||
      errorMsg.includes("not_ready")
    ) {
      chrome.notifications.create(`postureReminder-${Date.now()}`, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "🐧 姿势企鹅提醒",
        message: `自动检测遇到问题：${errorMsg}。将在下次定时重试。`,
        priority: 1,
      });
    }
    return;
  }

  if (!isValidDetectionResult(response.result)) {
    console.log(
      "[BG] 检测结果无效（无人/低置信度），跳过",
      response.result.issues,
    );
    return;
  }

  console.log(
    `[BG] ✅ 自动检测完成: 评分=${response.result.score}, 问题=${response.result.issues.join(",") || "无"}`,
  );

  // 持久化检测结果到 chrome.storage.local
  await savePostureRecord(response.result);

  if (response.result.score < 70) {
    notifyPostureIssue(response.result.score, response.result.issues);
  }
});

// 监听来自 popup/content/offscreen 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Offscreen document 消息
  if (message.type === "OFFSCREEN_READY") {
    offscreenDocumentCreated = true;
    console.log("[BG] Offscreen document ready");
    return false;
  }

  if (message.type === "CAMERA_READY") {
    cameraReady = Boolean(message.success);
    console.log("[BG] Camera ready:", message.success, message.error || "");
    return false;
  }

  // Popup 消息
  if (message.type === "START_DETECTION") {
    (async () => {
      await setDetectionEnabled(true);
      const settings = await getSettings();
      console.log(
        `[BG] START_DETECTION: 启用检测，间隔=${settings.checkInterval}分钟`,
      );
      await createDetectionAlarm(settings.checkInterval);
      // 预热模型是优化手段，失败不阻塞检测启动
      // alarm 触发时 offscreen 的 analyzePostureOnce() 会自行加载模型
      prewarmDetector().catch((err) => {
        console.warn("[BG] START_DETECTION: 预热模型失败（不影响检测）:", err);
      });
      sendResponse({ success: true, cameraReady: false });
    })().catch((error) => {
      console.error("[BG] START_DETECTION failed:", error);
      sendResponse({ success: false, error: String(error) });
    });
    return true;
  }

  if (message.type === "STOP_DETECTION") {
    (async () => {
      await setDetectionEnabled(false);
      chrome.alarms.clear(DETECTION_ALARM);
      await stopCamera();
      await closeOffscreenDocument();
      sendResponse({ success: true });
    })().catch((error) => {
      console.error("[BG] STOP_DETECTION failed:", error);
      sendResponse({ success: false, error: String(error) });
    });
    return true;
  }

  if (message.type === "GET_DETECTION_STATUS") {
    (async () => {
      sendResponse({
        enabled: await isDetectionEnabled(),
        cameraReady,
      });
    })().catch(() => {
      sendResponse({ enabled: false, cameraReady: false });
    });
    return true;
  }

  if (message.type === "UPDATE_INTERVAL") {
    (async () => {
      const enabled = await isDetectionEnabled();
      if (enabled && typeof message.interval === "number") {
        createDetectionAlarm(message.interval);
      }
      sendResponse({ success: true });
    })().catch((error) => {
      console.error("[BG] UPDATE_INTERVAL failed:", error);
      sendResponse({ success: false, error: String(error) });
    });
    return true;
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
chrome.alarms.create(CLEANUP_ALARM, {
  periodInMinutes: 24 * 60, // 每天清理一次
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== CLEANUP_ALARM) return;

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
});

export {};
