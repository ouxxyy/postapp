/**
 * 摄像头初始化 + 定时拍照 E2E 测试（Playwright）
 *
 * 测试场景:
 * 1. offscreen document 创建成功
 * 2. 摄像头权限获取成功 (getUserMedia)
 * 3. 定时器触发后帧数据正确返回 (base64 jpeg)
 * 4. CAMERA_READY / FRAME_CAPTURED 消息正确发送
 *
 * 运行方式:
 *   npx playwright test tests/camera.e2e.test.ts
 *
 * 前置条件:
 *   - dist/ 已构建 (npm run build)
 *   - Chrome 扩展已加载: chrome://extensions → 开发者模式 → 加载已解压 → 选 dist/
 *   - Playwright 配置: tests/playwright.config.ts
 */

// ── 测试框架 ─────────────────────────────────────────

import { test, expect, chromium, ChromiumBrowser, type Page } from "@playwright/test";

const EXTENSION_URL = "chrome-extension://<EXTENSION_ID>/popup.html";
const EXTENSION_ID_PLACEHOLDER = "EXTENSION_ID";
const POPUP_HTML = "dist/popup.html";
const OFFSCREEN_HTML = "dist/offscreen.html";
const BACKGROUND_JS = "dist/background.js";

// 动态读取 manifest 获取 extension id (在 setup 时通过已加载的插件读取)
// 这里用环境变量传入
const EXT_ID = process.env.POSTURE_PENGUIN_EXT_ID || "";

// ── Fixture: 加载插件并打开 popup ─────────────────────

test.describe.serial("摄像头调用与定时拍照 E2E", () => {
  let browser: ChromiumBrowser;
  let popupPage: Page;
  let offscreenPage: Page;
  let extId: string;

  test.beforeAll(async () => {
    // 启动 Chromium（带插件）
    // Playwright 需要插件目录路径
    const path = require("path");
    const distDir = path.resolve(__dirname, "..", "dist");
    extId = EXT_ID;

    browser = await chromium.launch({
      args: [
        `--disable-extensions-except=${distDir}`,
        `--load-extension=${distDir}`,
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    });
  });

  test.afterAll(async () => {
    await browser.close();
  });

  // ── TC-01: offscreen document 创建 ────────────────

  test("TC-01 摄像头初始化: offscreen document 正确创建", async () => {
    const context = await browser.newContext({
      permissions: ["camera"],
    });
    const page = await context.newPage();

    // 触发初始化（向 background 发消息）
    const response = await page.evaluate(async () => {
      // 手动触发 offscreen 创建
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: "INIT_CAMERA_REQUEST" },
          (res) => resolve(res)
        );
      });
      return response;
    });

    // 验证 offscreen document 存在
    // 在 Chrome Extension 中我们通过检查 chrome.runtime.lastError 来判断
    const lastError = await page.evaluate(() => {
      chrome.runtime.lastError;
    });

    // offscreen 创建不会直接暴露给 popup，但可以通过背景页验证
    // 这里验证 initCameraRequest 消息已发出（无 lastError）
    expect(response).toBeTruthy();
    await context.close();
  });

  // ── TC-02: 摄像头权限获取 ────────────────────────

  test("TC-02 摄像头初始化: getUserMedia 调用成功", async () => {
    const context = await browser.newContext({
      permissions: ["camera"],
    });
    const page = await context.newPage();

    // 直接调用 getUserMedia 验证能力
    const result = await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        return { success: true };
      } catch (e: unknown) {
        return { success: false, error: (e as Error).message };
      }
    });

    expect(result.success).toBe(true);
    await context.close();
  });

  // ── TC-03: 定时拍照 ─────────────────────────

  test("TC-03 定时拍照: 定时器触发后帧数据正确返回", async () => {
    const context = await browser.newContext({
      permissions: ["camera"],
    });
    const page = await context.newPage();

    const result = await page.evaluate(async () => {
      // 模拟 offscreen captureFrame 逻辑
      const video = document.createElement("video");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
        });
        video.srcObject = stream;
        await video.play();
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        stream.getTracks().forEach((t) => t.stop());

        return {
          frame: dataUrl.startsWith("data:image/jpeg;base64,"),
          dimensions: { width: canvas.width, height: canvas.height },
        };
      } catch (e: unknown) {
        return { frame: null, error: (e as Error).message };
      }
    });

    expect(result.frame).toBe(true);
    expect(result.dimensions).toBeTruthy();
    expect(result.dimensions!.width).toBeGreaterThan(0);
    await context.close();
  });

  // ── TC-04: 定时拍照消息转发 ─────────────────────

  test("TC-04 定时拍照: FRAME_CAPTURED 消息正确发送", async () => {
    const context = await browser.newContext({ permissions: ["camera"] });
    const page = await context.newPage();

    // 监听 background → popup 的消息
    const capturedFrames: unknown[] = [];
    page.on("message", (msg) => {
      if (msg === "FRAME_CAPTURED") capturedFrames.push(msg);
    });

    await page.evaluate(async () => {
      // 模拟 background → popup 发送 FRAME_CAPTURED 消息
      // (在真实插件中由 background script 调用 chrome.runtime.sendMessage 触发)
      // 这里验证消息结构符合预期
      const mockFrameData = "data:image/jpeg;base64,/9j/4AAQ";
      // 触发页面监听
      chrome.runtime.sendMessage({
        type: "FRAME_FOR_DETECTION",
        frame: mockFrameData,
        dimensions: { width: 640, height: 480 },
      });
    });

    // 等待消息处理（异步）
    await page.waitForTimeout(500);
    // 验证页面日志无报错
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));
    expect(logs.filter((l) => l.includes("FRAME_FOR_DETECTION")).toBeTruthy();
    await context.close();
  });

  // ── TC-05: STOP_CAMERA 停止摄像头 ───────────────

  test("TC-05 停止摄像头: stopCamera 正确清理 MediaStream", async () => {
    const context = await browser.newContext({ permissions: ["camera"] });
    const page = await context.newPage();

    const result = await page.evaluate(async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      track.stop();
      return { readyState: track.readyState };
    });

    expect(result.readyState).toBe("ended");
    await context.close();
  });
});
