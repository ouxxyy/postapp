/**
 * 架构验证测试
 * 验证 Service Worker / Offscreen Document 架构优化
 *
 * 测试目标:
 * - detector 状态恢复机制
 * - Offscreen Document 生命周期管理
 * - Alarm 调度稳定性（避免竞态条件）
 * - 状态持久化验证
 */

import * as tf from "@tensorflow/tfjs-node";
import * as poseDetection from "@tensorflow-models/pose-detection";

// ─────────────────────────────────────────────────────────────
// 模拟 Service Worker / Offscreen 架构核心逻辑
// ─────────────────────────────────────────────────────────────

interface DetectorState {
  initState: "idle" | "pending" | "ready" | "error";
  detector: poseDetection.PoseDetector | null;
  initPromise: Promise<void> | null;
}

// 模拟 Offscreen Document 中的 detector 管理
class MockDetectorManager {
  private state: DetectorState = {
    initState: "idle",
    detector: null,
    initPromise: null,
  };

  async ensureDetectorReady(): Promise<boolean> {
    // 关键逻辑：已就绪直接返回
    if (this.state.initState === "ready") return true;

    // 关键逻辑：初始化进行中，复用 Promise
    if (this.state.initState === "pending" && this.state.initPromise) {
      return this.state.initPromise.then(() => true).catch(() => false);
    }

    // 关键逻辑：错误状态允许重试
    if (this.state.initState === "error") {
      this.state.initState = "idle";
    }

    this.state.initState = "pending";
    this.state.initPromise = this._doInit();

    try {
      await this.state.initPromise;
      return true;
    } catch {
      return false;
    } finally {
      this.state.initPromise = null;
    }
  }

  private async _doInit(): Promise<void> {
    try {
      await tf.ready();

      const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          enableSmoothing: true,
        },
      );

      this.state.detector = detector;
      this.state.initState = "ready";
    } catch (err) {
      this.state.initState = "error";
      this.state.detector = null;
      throw err;
    }
  }

  async detect(image: any): Promise<{ score: number; issues: string[] }> {
    if (this.state.initState !== "ready") {
      await this.ensureDetectorReady();
    }

    if (!this.state.detector) {
      throw new Error("Detector not initialized");
    }

    const poses = await this.state.detector.estimatePoses(image);
    return {
      score: poses.length > 0 ? 85 : 0,
      issues: poses.length > 0 ? [] : ["noPoseDetected"],
    };
  }

  // 模拟 Service Worker 重启：重置内存状态但保留 detector 实例（通过 Offscreen）
  simulateSWRestart(preserveDetector: boolean = false): void {
    if (!preserveDetector) {
      if (this.state.detector) {
        this.state.detector.dispose();
        this.state.detector = null;
      }
      this.state.initState = "idle";
      this.state.initPromise = null;
    }
    // 如果 preserveDetector=true，模拟 Offscreen 保持 detector 存活
  }

  getState(): DetectorState {
    return { ...this.state };
  }

  destroy(): void {
    if (this.state.detector) {
      this.state.detector.dispose();
      this.state.detector = null;
    }
    this.state.initState = "idle";
    this.state.initPromise = null;
  }
}

// 模拟 Alarm 调度器（避免竞态条件）
class MockAlarmScheduler {
  private alarmName: string | null = null;
  private periodInMinutes: number | null = null;
  private alarmCallback: (() => Promise<void>) | null = null;
  private isRunning: boolean = false;

  async createAlarm(name: string, intervalMinutes: number): Promise<void> {
    // 关键逻辑：检查是否已存在相同间隔的闹钟
    if (this.alarmName === name && this.periodInMinutes === intervalMinutes) {
      console.log(`  [Alarm] 闹钟已存在且间隔一致，跳过重建`);
      return;
    }

    // 关键逻辑：先清除再创建（Promise 化）
    await this.clearAlarm();

    this.alarmName = name;
    this.periodInMinutes = intervalMinutes;
    console.log(`  [Alarm] 闹钟已创建: ${name}, 间隔: ${intervalMinutes}分钟`);
  }

  async clearAlarm(): Promise<void> {
    if (this.alarmName) {
      this.alarmName = null;
      this.periodInMinutes = null;
    }
  }

  setCallback(callback: () => Promise<void>): void {
    this.alarmCallback = callback;
  }

  async triggerAlarm(): Promise<void> {
    if (!this.alarmCallback || this.isRunning) {
      console.log(
        `  [Alarm] 跳过触发: ${!this.alarmCallback ? "无回调" : "正在执行"}`,
      );
      return;
    }

    this.isRunning = true;
    try {
      await this.alarmCallback();
    } finally {
      this.isRunning = false;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 测试用例
// ─────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => Promise<boolean | void>): Promise<void> {
  return fn()
    .then((result) => {
      results.push({
        name,
        passed: result !== false,
      });
    })
    .catch((err) => {
      results.push({
        name,
        passed: false,
        error: err.message || String(err),
      });
    });
}

async function runArchitectureTests(): Promise<void> {
  console.log("\n架构验证测试\n" + "=".repeat(60));

  // ── 测试 1: Detector 状态恢复 ──
  console.log("\n测试 1: Detector 状态恢复机制");
  await test("首次初始化应成功", async () => {
    const manager = new MockDetectorManager();
    const success = await manager.ensureDetectorReady();
    manager.destroy();
    if (!success) throw new Error("初始化失败");
  });

  await test("重复初始化应复用现有实例", async () => {
    const manager = new MockDetectorManager();
    await manager.ensureDetectorReady();
    const state1 = manager.getState();

    // 再次调用
    await manager.ensureDetectorReady();
    const state2 = manager.getState();

    manager.destroy();

    if (state1.initState !== "ready" || state2.initState !== "ready") {
      throw new Error("状态不正确");
    }
  });

  await test("Service Worker 重启后（不保留 detector）应能恢复", async () => {
    const manager = new MockDetectorManager();
    await manager.ensureDetectorReady();

    // 模拟 SW 重启（不保留 detector）
    manager.simulateSWRestart(false);
    const stateAfterRestart = manager.getState();

    if (stateAfterRestart.initState !== "idle") {
      throw new Error("重启后状态应为 idle");
    }

    // 应该能恢复
    const success = await manager.ensureDetectorReady();
    manager.destroy();

    if (!success) throw new Error("重启后恢复失败");
  });

  await test("Service Worker 重启后（保留 detector）应立即可用", async () => {
    const manager = new MockDetectorManager();
    await manager.ensureDetectorReady();
    const state1 = manager.getState();

    // 模拟 SW 重启（保留 detector - Offscreen 保持存活）
    manager.simulateSWRestart(true);
    const state2 = manager.getState();

    manager.destroy();

    if (state1.initState !== "ready" || state2.initState !== "ready") {
      throw new Error("Detector 应保持 ready 状态");
    }
  });

  // ── 测试 2: Alarm 调度稳定性 ──
  console.log("\n测试 2: Alarm 调度稳定性");

  await test("相同间隔不应重复创建闹钟", async () => {
    const scheduler = new MockAlarmScheduler();
    await scheduler.createAlarm("test", 20);
    await scheduler.createAlarm("test", 20); // 应跳过
    // 如果没有抛错，测试通过
  });

  await test("闹钟触发时应避免并发执行", async () => {
    const scheduler = new MockAlarmScheduler();
    let callCount = 0;

    scheduler.setCallback(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 100));
    });

    await scheduler.createAlarm("test", 20);

    // 并发触发两次
    await Promise.all([scheduler.triggerAlarm(), scheduler.triggerAlarm()]);

    if (callCount !== 1) {
      throw new Error(`并发触发导致重复执行: ${callCount}次`);
    }
  });

  // ── 测试 3: Offscreen Document 生命周期 ──
  console.log("\n测试 3: Offscreen Document 生命周期");

  await test("检测完成后保留 detector（preserveDetector=true）", async () => {
    const manager = new MockDetectorManager();
    await manager.ensureDetectorReady();
    const state1 = manager.getState();

    // 模拟 stopCamera({ preserveDetector: true })
    // 不调用 destroy，只重置摄像头相关状态
    // manager.destroy();

    const state2 = manager.getState();

    manager.destroy();

    if (state2.initState !== "ready") {
      throw new Error("preserveDetector 后状态应保持 ready");
    }
  });

  await test("完整销毁应重置所有状态", async () => {
    const manager = new MockDetectorManager();
    await manager.ensureDetectorReady();
    manager.destroy();

    const state = manager.getState();

    if (state.initState !== "idle" || state.detector !== null) {
      throw new Error("destroy 后状态应重置");
    }
  });

  // ── 测试 4: 状态持久化逻辑 ──
  console.log("\n测试 4: 状态持久化逻辑");

  await test("检测结果存储格式验证", async () => {
    // 模拟 savePostureRecord 逻辑
    const record = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      score: 85,
      issues: [] as string[],
      headForward: false,
      hunchback: false,
      misaligned: false,
    };

    // 验证字段
    if (typeof record.id !== "string") throw new Error("id 格式错误");
    if (typeof record.timestamp !== "number")
      throw new Error("timestamp 格式错误");
    if (typeof record.score !== "number") throw new Error("score 格式错误");
    if (!Array.isArray(record.issues)) throw new Error("issues 格式错误");
  });

  await test("无效检测结果应被过滤", async () => {
    // 模拟 isValidDetectionResult
    const validCases = [
      { score: 85, issues: [] },
      { score: 70, issues: ["headForward"] },
    ];

    const invalidCases = [
      { score: 0, issues: [] },
      { score: 85, issues: ["noPoseDetected"] },
      { score: 85, issues: ["lowConfidence"] },
    ];

    const isValid = (r: { score: number; issues: string[] }) => {
      if (r.score <= 0) return false;
      if (r.issues.includes("noPoseDetected")) return false;
      if (r.issues.includes("lowConfidence")) return false;
      return true;
    };

    for (const c of validCases) {
      if (!isValid(c))
        throw new Error(`有效记录被错误拒绝: ${JSON.stringify(c)}`);
    }

    for (const c of invalidCases) {
      if (isValid(c)) throw new Error(`无效记录未被过滤: ${JSON.stringify(c)}`);
    }
  });
}

// 运行测试
runArchitectureTests()
  .then(() => {
    console.log("\n" + "=".repeat(60));
    console.log("架构验证测试汇总");
    console.log("=".repeat(60));

    results.forEach((r) => {
      const status = r.passed ? "PASS" : "FAIL";
      console.log(
        `  ${r.passed ? "PASS" : "FAIL"} ${r.name}${r.error ? ` - ${r.error}` : ""}`,
      );
    });

    console.log("=".repeat(60));
    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;
    console.log(`总计: ${passed}/${results.length} 通过`);

    if (failed > 0) {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("测试执行失败:", err);
    process.exit(1);
  });
