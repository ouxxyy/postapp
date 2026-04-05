// Offscreen document for camera access
// This runs in a separate context that can access getUserMedia

let video: HTMLVideoElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let stream: MediaStream | null = null;
let isCapturing = false;

// Initialize camera
async function initCamera(): Promise<boolean> {
  try {
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
    console.error("Camera init error:", error);
    chrome.runtime.sendMessage({
      type: "CAMERA_READY",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
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
function stopCamera(): void {
  if (stream) {
    stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    stream = null;
  }
  if (video) {
    video.srcObject = null;
  }
  isCapturing = false;
}

// Start continuous capture
function startCapturing(interval: number = 1000): void {
  if (isCapturing) return;
  isCapturing = true;

  const capture = () => {
    if (!isCapturing) return;

    const frame = captureFrame();
    if (frame) {
      chrome.runtime.sendMessage({
        type: "FRAME_CAPTURED",
        frame: frame,
        dimensions: getVideoDimensions(),
      });
    }

    setTimeout(capture, interval);
  };

  capture();
}

// Listen for messages from background
chrome.runtime.onMessage.addListener(
  (message: { type: string; interval?: number }, sender, sendResponse) => {
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

      default:
        sendResponse({ error: "Unknown message type" });
        return false;
    }
  },
);

// Notify background that offscreen document is ready
chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" });
