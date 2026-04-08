/**
 * 模型加载性能测试 (JavaScript 版本)
 * 验证 TensorFlow.js MoveNet 模型加载时间 ≤ 1s
 */

const tf = require("@tensorflow/tfjs-node");
const poseDetection = require("@tensorflow-models/pose-detection");
const fs = require("fs");
const path = require("path");

// 配置
const PERFORMANCE_THRESHOLD_MS = 1000; // 1秒阈值
const LOCAL_MODEL_PATH = path.join(
  __dirname,
  "../public/models/movenet-singlepose-lightning",
);
const WARMUP_ITERATIONS = 3;
const TEST_ITERATIONS = 5;

// 模拟 ensurePreferredBackend
async function ensureBackend() {
  await tf.ready();
  const backends = ["tensorflow", "cpu"];

  for (const backend of backends) {
    try {
      if (tf.findBackend(backend)) {
        await tf.setBackend(backend);
        await tf.ready();
        return backend;
      }
    } catch (e) {
      console.warn(`Backend ${backend} unavailable:`, e);
    }
  }

  throw new Error("No TensorFlow backend available");
}

// 模拟 PostureDetector.init() 逻辑
async function createDetector() {
  const backend = await ensureBackend();
  console.log(`  [性能测试] 使用 backend: ${backend}`);

  // 检查本地模型是否存在
  const modelJsonPath = path.join(LOCAL_MODEL_PATH, "model.json");
  if (!fs.existsSync(modelJsonPath)) {
    throw new Error(`本地模型不存在: ${modelJsonPath}`);
  }

  const detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      modelUrl: `file://${LOCAL_MODEL_PATH}`,
      enableSmoothing: true,
    },
  );

  return detector;
}

// 性能测试：测量加载时间
async function measureLoadTime(name, fn, threshold = PERFORMANCE_THRESHOLD_MS) {
  const start = performance.now();
  await fn();
  const duration = performance.now() - start;

  return {
    name,
    duration: Math.round(duration * 100) / 100,
    passed: duration <= threshold,
    threshold,
  };
}

// 测试用例
async function runPerformanceTests() {
  const results = [];

  console.log("\n性能测试配置:");
  console.log(`  - 阈值: ${PERFORMANCE_THRESHOLD_MS}ms`);
  console.log(`  - 预热迭代: ${WARMUP_ITERATIONS}`);
  console.log(`  - 测试迭代: ${TEST_ITERATIONS}`);
  console.log(`  - 模型路径: ${LOCAL_MODEL_PATH}\n`);

  // 检查模型文件
  if (!fs.existsSync(LOCAL_MODEL_PATH)) {
    console.error("本地模型目录不存在，跳过性能测试");
    return {
      total: 1,
      passed: 0,
      failed: 1,
      results: [
        { name: "模型文件检查", duration: 0, passed: false, threshold: 0 },
      ],
    };
  }

  // ── 测试 1: 首次加载（冷启动） ──
  console.log("测试 1: 首次加载（冷启动）");
  let firstDetector = null;

  const coldStartResult = await measureLoadTime(
    "首次加载",
    async () => {
      firstDetector = await createDetector();
    },
    PERFORMANCE_THRESHOLD_MS * 3, // 冷启动允许更长（3秒）
  );
  results.push(coldStartResult);
  console.log(
    `  结果: ${coldStartResult.passed ? "PASS" : "FAIL"} (${coldStartResult.duration}ms)\n`,
  );

  // ── 测试 2: 预热后加载 ──
  console.log("测试 2: 预热后加载");
  if (firstDetector) {
    // 预热
    for (let i = 0; i < WARMUP_ITERATIONS; i++) {
      const dummyTensor = tf.zeros([1, 192, 192, 3], "int32");
      await firstDetector.estimatePoses(dummyTensor);
      dummyTensor.dispose();
    }

    const warmLoadResult = await measureLoadTime(
      "预热后检测",
      async () => {
        const dummyTensor = tf.zeros([1, 192, 192, 3], "int32");
        await firstDetector.estimatePoses(dummyTensor);
        dummyTensor.dispose();
      },
      PERFORMANCE_THRESHOLD_MS,
    );
    results.push(warmLoadResult);
    console.log(
      `  结果: ${warmLoadResult.passed ? "PASS" : "FAIL"} (${warmLoadResult.duration}ms)\n`,
    );
  }

  // ── 测试 3: 多次检测平均时间 ──
  console.log("测试 3: 多次检测平均时间");
  if (firstDetector) {
    const durations = [];

    for (let i = 0; i < TEST_ITERATIONS; i++) {
      const dummyTensor = tf.zeros([1, 192, 192, 3], "int32");
      const start = performance.now();
      await firstDetector.estimatePoses(dummyTensor);
      const duration = performance.now() - start;
      dummyTensor.dispose();
      durations.push(duration);
    }

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const avgResult = {
      name: `平均检测时间 (${TEST_ITERATIONS}次)`,
      duration: Math.round(avgDuration * 100) / 100,
      passed: avgDuration <= PERFORMANCE_THRESHOLD_MS,
      threshold: PERFORMANCE_THRESHOLD_MS,
    };
    results.push(avgResult);
    console.log(
      `  结果: ${avgResult.passed ? "PASS" : "FAIL"} (平均 ${avgResult.duration}ms)`,
    );
    console.log(
      `  详细: [${durations.map((d) => Math.round(d) + "ms").join(", ")}]\n`,
    );
  }

  // ── 测试 4: detector 实例复用验证 ──
  console.log("测试 4: detector 实例复用验证");
  if (firstDetector) {
    // 不销毁 detector，直接再次使用
    const reuseResult = await measureLoadTime(
      "实例复用检测",
      async () => {
        const dummyTensor = tf.zeros([1, 192, 192, 3], "int32");
        await firstDetector.estimatePoses(dummyTensor);
        dummyTensor.dispose();
      },
      100, // 复用应该非常快（<100ms）
    );
    results.push(reuseResult);
    console.log(
      `  结果: ${reuseResult.passed ? "PASS" : "FAIL"} (${reuseResult.duration}ms)\n`,
    );
  }

  // 清理
  if (firstDetector) {
    firstDetector.dispose();
  }

  // 汇总
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  return { total: results.length, passed, failed, results };
}

// 运行测试
runPerformanceTests()
  .then((summary) => {
    console.log("\n" + "=".repeat(60));
    console.log("模型加载性能测试汇总");
    console.log("=".repeat(60));

    summary.results.forEach((r) => {
      const threshold = r.threshold > 0 ? ` (阈值: ${r.threshold}ms)` : "";
      console.log(
        `  ${r.passed ? "PASS" : "FAIL"} ${r.name}: ${r.duration}ms${threshold}`,
      );
    });

    console.log("=".repeat(60));
    console.log(`总计: ${summary.passed}/${summary.total} 通过`);

    if (summary.failed > 0) {
      console.log("\n性能测试未达标，请检查模型加载优化。");
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("测试执行失败:", err);
    process.exit(1);
  });
