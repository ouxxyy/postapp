// Offscreen document for camera access and posture detection
// This runs in a separate context that can access getUserMedia and TensorFlow.js

import PostureDetector from "../lib/PostureDetector";

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

let video: HTMLVideoElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let stream: MediaStream | null = null;
let isAnalyzing = false;

const CAMERA_STABILIZATION_MS = 900;
const ANALYSIS_RETRY_DELAY_MS = 300;
const MAX_ANALYSIS_ATTEMPTS = 3;

const detector = new PostureDetector();
let detectorReady = false;
let detectorInitPromise: Promise<boolean> | null = null;

async function ensureDetectorReady(): Promise<boolean> {
  if (detectorReady) return true;
  if (detectorInitPromise) return detectorInitPromise;

  detectorInitPromise = (async () => {
    try {
      await detector.init();
      detectorReady = true;
      return true;
    } catch (error) {
      detectorReady = false;
      console.error("[Offscreen] Detector init failed:", error);
      return false;
    } finally {
      detectorInitPromise = null;
    }
  })();

  return detectorInitPromise;
}

// Initialize camera
async function initCamera(): Promise<boolean> {
  try {
    if (stream && video?.srcObject) {
      chrome.runtime.sendMessage({
        type: "CAMERA_READY",
        success: true,
      });
      return true;
    }

    video = document.getElementById("video") as HTMLVideoElement;
    canvas = document.getElementById("canvas") as HTMLCanvasElement;
    ctx = canvas.getContext("2d");

    if (!video || !canvas || !ctx) {
      throw new Error("Failed to get video or canvas elements");
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user",
      },
    });

    video.srcObject = stream;
    await video.play();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    chrome.runtime.sendMessage({
      type: "CAMERA_READY",
      success: true,
    });

    return true;
  } catch (error) {
    console.error("[Offscreen] Camera init error:", error);
    chrome.runtime.sendMessage({
      type: "CAMERA_READY",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function waitForVideoReady(): Promise<boolean> {
  const videoEl = video;
  if (!videoEl) return false;
  if (
    videoEl.readyState >= 2 &&
    videoEl.videoWidth > 0 &&
    videoEl.videoHeight > 0
  ) {
    return true;
  }

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const maxWaitMs = 6000;
    const timer = window.setInterval(() => {
      const ready =
        videoEl.readyState >= 2 &&
        videoEl.videoWidth > 0 &&
        videoEl.videoHeight > 0;
      const timedOut = Date.now() - startedAt >= maxWaitMs;

      if (ready || timedOut) {
        window.clearInterval(timer);
        resolve(ready);
      }
    }, 100);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function analyzePostureOnce(): Promise<AnalyzePostureResponse> {
  console.log("[Offscreen] analyzePostureOnce 被调用");
  if (isAnalyzing) {
    console.warn("[Offscreen] 分析正在进行中，跳过本次请求");
    return { success: false, error: "analysis_in_progress" };
  }
  isAnalyzing = true;

  try {
    console.log("[Offscreen] 步骤1: 初始化摄像头...");
    const cameraOk = await initCamera();
    if (!cameraOk || !video) {
      console.error("[Offscreen] 摄像头初始化失败");
      return { success: false, error: "camera_not_ready" };
    }
    console.log("[Offscreen] 步骤1完成: 摄像头就绪 ✅");

    // 模型加载与视频预热并行
    console.log("[Offscreen] 步骤2: 并行加载模型和等待视频就绪...");
    const detectorReadyPromise = ensureDetectorReady();
    const videoReady = await waitForVideoReady();
    if (!videoReady) {
      console.error("[Offscreen] 视频画面未就绪");
      return { success: false, error: "video_not_ready" };
    }
    console.log("[Offscreen] 视频画面就绪 ✅");

    const detectorOk = await detectorReadyPromise;
    if (!detectorOk) {
      console.error("[Offscreen] 模型加载失败");
      return { success: false, error: "detector_init_failed" };
    }
    console.log("[Offscreen] 模型就绪 ✅");

    await delay(CAMERA_STABILIZATION_MS);

    let result = await detector.detect(video);
    for (let attempt = 2; attempt <= MAX_ANALYSIS_ATTEMPTS; attempt++) {
      const invalidResult =
        result.issues.includes("noPoseDetected") ||
        result.issues.includes("lowConfidence");
      if (!invalidResult) {
        break;
      }

      console.warn(
        `[Offscreen] Detection attempt ${attempt - 1} returned ${result.issues.join(",") || "unknown"}, retrying...`,
      );
      await delay(ANALYSIS_RETRY_DELAY_MS);
      result = await detector.detect(video);
    }

    console.log("[Offscreen] 检测完成，返回结果给 background", result);

    return {
      success: true,
      result: {
        score: result.score,
        issues: result.issues,
        headForward: result.headForward,
        hunchback: result.hunchback,
        misaligned: result.misaligned,
      },
    };
  } catch (error) {
    console.error("[Offscreen] analyze posture failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // 自动检测时：每次分析后释放摄像头，避免常驻占用
    stopCamera({ preserveDetector: true });
    isAnalyzing = false;
  }
}

// Capture frame from video
function captureFrame(): string | null {
  if (!video || !ctx || !canvas) {
    return null;
  }

  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.8);
}

// Get video dimensions
function getVideoDimensions(): { width: number; height: number } | null {
  if (!video) return null;
  return {
    width: video.videoWidth,
    height: video.videoHeight,
  };
}

// Stop camera
function stopCamera(options?: { preserveDetector?: boolean }): void {
  if (stream) {
    stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    stream = null;
  }
  if (video) {
    video.srcObject = null;
  }
  isAnalyzing = false;
  if (!options?.preserveDetector) {
    detector.destroy();
    detectorReady = false;
    detectorInitPromise = null;
  }

  chrome.runtime.sendMessage({
    type: "CAMERA_READY",
    success: false,
  });
}

// Start continuous capture
function startCapturing(interval: number = 1000): void {
  let isCapturing = false;

  const capture = () => {
    if (isCapturing) return;
    isCapturing = true;

    const frame = captureFrame();
    if (frame) {
      chrome.runtime.sendMessage({
        type: "FRAME_CAPTURED",
        frame: frame,
        dimensions: getVideoDimensions(),
      });
    }

    setTimeout(() => {
      isCapturing = false;
      capture();
    }, interval);
  };

  capture();
}

// Listen for messages from background
chrome.runtime.onMessage.addListener(
  (
    message: { type: string; interval?: number },
    sender,
    sendResponse,
  ): boolean => {
    switch (message.type) {
      case "INIT_CAMERA":
        initCamera().then(sendResponse);
        return true;

      case "CAPTURE_FRAME":
        const frame = captureFrame();
        sendResponse({ frame, dimensions: getVideoDimensions() });
        return false;

      case "START_CAPTURING":
        startCapturing(message.interval);
        sendResponse({ success: true });
        return false;

      case "STOP_CAPTURING":
        stopCamera();
        sendResponse({ success: true });
        return false;

      case "STOP_CAMERA":
        stopCamera();
        sendResponse({ success: true });
        return false;

      case "ANALYZE_POSTURE":
        analyzePostureOnce().then(sendResponse);
        return true;

      case "PING_OFFSCREEN":
        sendResponse({
          ready: true,
          detectorReady,
          isAnalyzing,
          cameraReady: !!stream,
        });
        return false;

      default:
        sendResponse({ error: "Unknown message type" });
        return false;
    }
  },
);

// Notify background that offscreen document is ready
chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" });
