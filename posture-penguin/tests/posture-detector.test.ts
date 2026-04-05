/**
 * @ts-nocheck
 * PostureDetector 单元测试
 * 测试姿势分析算法各检测函数的行为
 *
 * MediaPipe BlazePose 关键点索引:
 *   0=NOSE, 7=LEFT_EAR, 8=RIGHT_EAR
 *  11=LEFT_SHOULDER, 12=RIGHT_SHOULDER
 *  23=LEFT_HIP, 24=RIGHT_HIP
 */

type Landmark = { x: number; y: number; z: number };

function makeLandmarks(
  overrides: Partial<Record<number, Landmark>> = {}
): Record<number, Landmark> {
  const defaults: Record<number, Landmark> = {
    0:  { x: 0.5,  y: 0.1,  z: 0 },
    7:  { x: 0.48, y: 0.05, z: 0 },
    8:  { x: 0.52, y: 0.05, z: 0 },
    11: { x: 0.4,  y: 0.3,  z: 0 },
    12: { x: 0.6,  y: 0.3,  z: 0 },
    23: { x: 0.45, y: 0.6,  z: 0 },
    24: { x: 0.55, y: 0.6,  z: 0 },
  };
  return Object.assign(Object.assign({}, defaults), overrides);
}

/** 头前倾检测: verticalDist < 0.15 或 horizontalDist > 0.1 → headForward=true */
function detectHeadForward(
  leftEar: Landmark,
  rightEar: Landmark,
  leftShoulder: Landmark,
  rightShoulder: Landmark,
): boolean {
  const earMidY = (leftEar.y + rightEar.y) / 2;
  const earMidX = (leftEar.x + rightEar.x) / 2;
  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
  const verticalDist = shoulderMidY - earMidY;
  const horizontalDist = Math.abs(earMidX - shoulderMidX);
  return verticalDist < 0.15 || horizontalDist > 0.1;
}

/** 驼背检测: |leftShoulder.y - rightShoulder.y| > 0.05 → hunchback=true */
function detectHunchback(
  leftShoulder: Landmark,
  rightShoulder: Landmark,
): boolean {
  const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
  return shoulderDiff > 0.05;
}

/** 坐姿不正检测: |nose.x - bodyMidX| > 0.1 → misaligned=true */
function detectMisalignment(
  nose: Landmark,
  leftShoulder: Landmark,
  rightShoulder: Landmark,
  leftHip: Landmark,
  rightHip: Landmark,
): boolean {
  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
  const hipMidX = (leftHip.x + rightHip.x) / 2;
  const bodyMidX = (shoulderMidX + hipMidX) / 2;
  const deviation = Math.abs(nose.x - bodyMidX);
  return deviation > 0.1;
}

/** 综合评分 */
function scorePosture(l: Record<number, Landmark>): { score: number; issues: string[] } {
  let score = 100;
  const issues: string[] = [];
  if (detectHeadForward(l[7], l[8], l[11], l[12])) {
    issues.push("headForward"); score -= 25;
  }
  if (detectHunchback(l[11], l[12])) {
    issues.push("hunchback"); score -= 20;
  }
  if (detectMisalignment(l[0], l[11], l[12], l[23], l[24])) {
    issues.push("misaligned"); score -= 15;
  }
  score = Math.max(0, Math.min(100, score));
  return { score, issues };
}

// ── 测试用例定义 ──────────────────────────────────────

interface TestResult { passed: boolean; name: string; score?: number; issues?: string[]; note?: string }

const testCases: Array<() => TestResult> = [
  // ── detectHeadForward ──────────────────────────────
  () => {
    // 正常: 耳朵在肩膀上方，垂直距离充足
    const l = makeLandmarks({
      7: { x: 0.5, y: 0.05, z: 0 },
      8: { x: 0.5, y: 0.05, z: 0 },
      11: { x: 0.4, y: 0.3, z: 0 },
      12: { x: 0.6, y: 0.3, z: 0 },
    });
    const r = detectHeadForward(l[7], l[8], l[11], l[12]);
    return { passed: r === false, name: "HF-01 正常坐姿 → 不头前倾" };
  },

  () => {
    // 头前倾: verticalDist=0.02 < 0.15
    const l = makeLandmarks({
      7: { x: 0.5, y: 0.28, z: 0 },
      8: { x: 0.5, y: 0.28, z: 0 },
      11: { x: 0.4, y: 0.3, z: 0 },
      12: { x: 0.6, y: 0.3, z: 0 },
    });
    const r = detectHeadForward(l[7], l[8], l[11], l[12]);
    return { passed: r === true, name: "HF-02 头前倾 → headForward=true" };
  },

  () => {
    // 头前倾: horizontalDist=0.2 > 0.1
    const l = makeLandmarks({
      7: { x: 0.7, y: 0.05, z: 0 },
      8: { x: 0.8, y: 0.05, z: 0 },
      11: { x: 0.4, y: 0.3, z: 0 },
      12: { x: 0.6, y: 0.3, z: 0 },
    });
    const r = detectHeadForward(l[7], l[8], l[11], l[12]);
    return { passed: r === true, name: "HF-03 头部明显偏移 → headForward=true" };
  },

  () => {
    // 边界: verticalDist=0.15 恰好等于阈值 → 不头前倾
    const l = makeLandmarks({
      7: { x: 0.5, y: 0.15, z: 0 },
      8: { x: 0.5, y: 0.15, z: 0 },
      11: { x: 0.4, y: 0.3, z: 0 },
      12: { x: 0.6, y: 0.3, z: 0 },
    });
    const r = detectHeadForward(l[7], l[8], l[11], l[12]);
    return { passed: r === false, name: "HF-04 边界值 verticalDist=0.15 → 不头前倾" };
  },

  // ── detectHunchback ───────────────────────────────
  () => {
    // 正常: 两肩齐平
    const l = makeLandmarks({ 11: { x: 0.4, y: 0.3, z: 0 }, 12: { x: 0.6, y: 0.3, z: 0 } });
    const r = detectHunchback(l[11], l[12]);
    return { passed: r === false, name: "HB-01 双肩平 → 不驼背" };
  },

  () => {
    // 驼背: diff=0.12 > 0.05
    const l = makeLandmarks({ 11: { x: 0.4, y: 0.2, z: 0 }, 12: { x: 0.6, y: 0.32, z: 0 } });
    const r = detectHunchback(l[11], l[12]);
    return { passed: r === true, name: "HB-02 左肩高0.1 → hunchback=true" };
  },

  () => {
    // 驼背: diff=0.06 > 0.05
    const l = makeLandmarks({ 11: { x: 0.4, y: 0.3, z: 0 }, 12: { x: 0.6, y: 0.36, z: 0 } });
    const r = detectHunchback(l[11], l[12]);
    return { passed: r === true, name: "HB-03 diff=0.06 > 0.05 → hunchback=true" };
  },

  () => {
    // 边界: diff=0.05 恰好等于阈值 → 不驼背
    const l = makeLandmarks({ 11: { x: 0.4, y: 0.3, z: 0 }, 12: { x: 0.6, y: 0.35, z: 0 } });
    const r = detectHunchback(l[11], l[12]);
    return { passed: r === false, name: "HB-04 diff=0.05 边界 → 不驼背" };
  },

  // ── detectMisalignment ────────────────────────────
  () => {
    // 正常: 鼻子对准身体中线
    const l = makeLandmarks({
      0:  { x: 0.5,  y: 0.1, z: 0 },
      11: { x: 0.4,  y: 0.3, z: 0 },
      12: { x: 0.6,  y: 0.3, z: 0 },
      23: { x: 0.45, y: 0.6, z: 0 },
      24: { x: 0.55, y: 0.6, z: 0 },
    });
    const r = detectMisalignment(l[0], l[11], l[12], l[23], l[24]);
    return { passed: r === false, name: "MA-01 身体正中 → 不歪斜" };
  },

  () => {
    // 歪斜: nose.x=0.8 vs bodyMidX=0.5 → deviation=0.3 > 0.1
    const l = makeLandmarks({
      0:  { x: 0.8,  y: 0.1, z: 0 },
      11: { x: 0.4,  y: 0.3, z: 0 },
      12: { x: 0.6,  y: 0.3, z: 0 },
      23: { x: 0.45, y: 0.6, z: 0 },
      24: { x: 0.55, y: 0.6, z: 0 },
    });
    const r = detectMisalignment(l[0], l[11], l[12], l[23], l[24]);
    return { passed: r === true, name: "MA-02 鼻子明显偏右 → misaligned=true" };
  },

  () => {
    // 边界: deviation=0.1 恰好等于阈值 → 不歪斜
    const l = makeLandmarks({
      0:  { x: 0.6,  y: 0.1, z: 0 }, // bodyMidX=0.5 → deviation=0.1
      11: { x: 0.4,  y: 0.3, z: 0 },
      12: { x: 0.6,  y: 0.3, z: 0 },
      23: { x: 0.45, y: 0.6, z: 0 },
      24: { x: 0.55, y: 0.6, z: 0 },
    });
    const r = detectMisalignment(l[0], l[11], l[12], l[23], l[24]);
    return { passed: r === false, name: "MA-03 deviation=0.1 边界 → 不歪斜" };
  },

  // ── 综合评分 ───────────────────────────────────
  () => {
    // 完美姿势: score=100, issues=[]
    const l = makeLandmarks();
    const { score, issues } = scorePosture(l);
    return {
      passed: score === 100 && issues.length === 0,
      name: "SC-01 完美姿势 → score=100",
      score, issues,
    };
  },

  () => {
    // 只有头前倾: score=75, issues=[headForward]
    const l = makeLandmarks({
      7: { x: 0.6,  y: 0.28, z: 0 },
      8: { x: 0.7,  y: 0.28, z: 0 },
    });
    const { score, issues } = scorePosture(l);
    return {
      passed: score === 75 && issues.includes("headForward") && issues.length === 1,
      name: "SC-02 头前倾 → score=75",
      score, issues,
    };
  },

  () => {
    // headForward + hunchback: score=55, issues=[headForward, hunchback]
    const l = makeLandmarks({
      7: { x: 0.6,  y: 0.28, z: 0 },
      8: { x: 0.7,  y: 0.28, z: 0 },
      11: { x: 0.35, y: 0.2, z: 0 },
      12: { x: 0.65, y: 0.3, z: 0 },
    });
    const { score, issues } = scorePosture(l);
    return {
      passed: score === 55 && issues.includes("headForward") && issues.includes("hunchback"),
      name: "SC-03 headForward+hunchback → score=55",
      score, issues,
    };
  },

  () => {
    // 三项全触发: score=40, issues包含全部3项
    const l = makeLandmarks({
      0:  { x: 0.75, y: 0.1,  z: 0 },
      7:  { x: 0.7,  y: 0.28, z: 0 },
      8:  { x: 0.8,  y: 0.28, z: 0 },
      11: { x: 0.35, y: 0.2,  z: 0 },
      12: { x: 0.65, y: 0.3,  z: 0 },
    });
    const { score, issues } = scorePosture(l);
    return {
      passed: score === 40 && issues.length === 3,
      name: "SC-04 全触发 → score=40",
      score, issues,
    };
  },

  () => {
    // 分数下界: score=0
    const l = makeLandmarks({
      0:  { x: 1.0,  y: 0.1,  z: 0 },
      7:  { x: 0.9,  y: 0.4,  z: 0 },
      8:  { x: 1.0,  y: 0.4,  z: 0 },
      11: { x: 0.2,  y: 0.1,  z: 0 },
      12: { x: 0.8,  y: 0.3,  z: 0 },
    });
    const { score, issues } = scorePosture(l);
    return {
      passed: score === 0 && issues.length === 3,
      name: "SC-05 极差姿势 → score=0 (下界)",
      score, issues,
    };
  },
];

// ── 运行测试 ─────────────────────────────────────────

console.log("🧪 PostureDetector 单元测试\n");
console.log("═".repeat(60));

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  try {
    const result = tc();
    if (result.passed) {
      passed++;
      console.log(`  ✅ ${result.name}`);
    } else {
      failed++;
      console.log(`  ❌ ${result.name}`);
      if ("score" in result) console.log(`     score=${result.score} issues=${JSON.stringify(result.issues)}`);
    }
  } catch (e: unknown) {
    failed++;
    console.log(`  ❌ ${(e as Error).message}`);
  }
}

console.log("═".repeat(60));
console.log(`\n测试结果: ${passed} 通过 / ${failed} 失败`);

if (failed > 0) process.exit(1);
