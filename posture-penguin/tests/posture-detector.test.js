#!/usr/bin/env node
/**
 * PostureDetector 单元测试（纯 JavaScript）
 *
 * MediaPipe BlazePose 关键点索引:
 *   0=NOSE, 7=LEFT_EAR, 8=RIGHT_EAR
 *  11=LEFT_SHOULDER, 12=RIGHT_SHOULDER
 *  23=LEFT_HIP, 24=RIGHT_HIP
 */

// ── 测试数据工厂 ─────────────────────────────────

function makeLandmarks(overrides) {
  var defaults = {
    0:  { x: 0.5,  y: 0.1,  z: 0 },
    7:  { x: 0.48, y: 0.05, z: 0 },
    8:  { x: 0.52, y: 0.05, z: 0 },
    11: { x: 0.4,  y: 0.3,  z: 0 },
    12: { x: 0.6,  y: 0.3,  z: 0 },
    23: { x: 0.45, y: 0.6,  z: 0 },
    24: { x: 0.55, y: 0.6,  z: 0 },
  };
  var keys = Object.keys(overrides || {});
  for (var i = 0; i < keys.length; i++) {
    defaults[keys[i]] = overrides[keys[i]];
  }
  return defaults;
}

// ── 检测函数（复刻 PostureDetector.ts 逻辑）──────────────

/**
 * detectHeadForward
 * threshold: verticalDist < 0.15 || horizontalDist > 0.1
 */
function detectHeadForward(leftEar, rightEar, leftShoulder, rightShoulder) {
  var earMidY = (leftEar.y + rightEar.y) / 2;
  var earMidX = (leftEar.x + rightEar.x) / 2;
  var shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
  var shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
  var verticalDist = shoulderMidY - earMidY;
  var horizontalDist = Math.abs(earMidX - shoulderMidX);
  return verticalDist < 0.15 || horizontalDist > 0.1;
}

/**
 * detectHunchback
 * threshold: |leftShoulder.y - rightShoulder.y| > 0.05
 */
function detectHunchback(leftShoulder, rightShoulder) {
  var diff = Math.abs(leftShoulder.y - rightShoulder.y);
  return diff > 0.05;
}

/**
 * detectMisalignment
 * threshold: |nose.x - bodyMidX| > 0.1
 */
function detectMisalignment(nose, leftShoulder, rightShoulder, leftHip, rightHip) {
  var shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
  var hipMidX = (leftHip.x + rightHip.x) / 2;
  var bodyMidX = (shoulderMidX + hipMidX) / 2;
  var deviation = Math.abs(nose.x - bodyMidX);
  return deviation > 0.1;
}

/**
 * 综合评分
 */
function scorePosture(l) {
  var s = 100;
  var issues = [];
  if (detectHeadForward(l[7], l[8], l[11], l[12])) {
    issues.push("headForward"); s -= 25;
  }
  if (detectHunchback(l[11], l[12])) {
    issues.push("hunchback"); s -= 20;
  }
  if (detectMisalignment(l[0], l[11], l[12], l[23], l[24])) {
    issues.push("misaligned"); s -= 15;
  }
  s = Math.max(0, Math.min(100, s));
  return { score: s, issues: issues };
}

// ── 测试用例定义 ─────────────────────────────────

var TESTS = [
  // HF-01~04: detectHeadForward
  {
    name: "HF-01 正常坐姿（耳在肩上）→ 不头前倾",
    expect: false,
    fn: function() {
      return detectHeadForward(
        { x: 0.5, y: 0.05 }, { x: 0.5, y: 0.05 },
        { x: 0.4, y: 0.3 },  { x: 0.6, y: 0.3 }
      );
    },
  },
  {
    name: "HF-02 头前倾（vertical=0.02 < 0.15）→ headForward=true",
    expect: true,
    fn: function() {
      return detectHeadForward(
        { x: 0.5, y: 0.28 }, { x: 0.5, y: 0.28 },
        { x: 0.4, y: 0.3 },  { x: 0.6, y: 0.3 }
      );
    },
  },
  {
    name: "HF-03 头部偏移 horizontal=0.2 > 0.1 → headForward=true",
    expect: true,
    fn: function() {
      return detectHeadForward(
        { x: 0.7, y: 0.05 }, { x: 0.8, y: 0.05 },
        { x: 0.4, y: 0.3 },  { x: 0.6, y: 0.3 }
      );
    },
  },
  {
    name: "HF-04 边界 verticalDist=0.15 → 不头前倾",
    expect: false,
    fn: function() {
      return detectHeadForward(
        { x: 0.5, y: 0.15 }, { x: 0.5, y: 0.15 },
        { x: 0.4, y: 0.3 },  { x: 0.6, y: 0.3 }
      );
    },
  },

  // HB-01~04: detectHunchback
  {
    name: "HB-01 双肩齐平 → 不驼背",
    expect: false,
    fn: function() {
      return detectHunchback({ x: 0.4, y: 0.3 }, { x: 0.6, y: 0.3 });
    },
  },
  {
    name: "HB-02 肩膀高度差 diff=0.12 > 0.05 → hunchback=true",
    expect: true,
    fn: function() {
      return detectHunchback({ x: 0.4, y: 0.2 }, { x: 0.6, y: 0.32 });
    },
  },
  {
    name: "HB-03 diff=0.06 > 0.05 → hunchback=true",
    expect: true,
    fn: function() {
      return detectHunchback({ x: 0.4, y: 0.3 }, { x: 0.6, y: 0.36 });
    },
  },
  {
    name: "HB-04 边界 diff=0.05 → 不驼背",
    expect: false,
    fn: function() {
      return detectHunchback({ x: 0.4, y: 0.3 }, { x: 0.6, y: 0.35 });
    },
  },

  // MA-01~03: detectMisalignment
  {
    name: "MA-01 身体正中 → 不歪斜",
    expect: false,
    fn: function() {
      return detectMisalignment(
        { x: 0.5, y: 0.1 },
        { x: 0.4, y: 0.3 }, { x: 0.6, y: 0.3 },
        { x: 0.45, y: 0.6 }, { x: 0.55, y: 0.6 }
      );
    },
  },
  {
    name: "MA-02 鼻子偏右 deviation=0.3 > 0.1 → misaligned=true",
    expect: true,
    fn: function() {
      return detectMisalignment(
        { x: 0.8, y: 0.1 },
        { x: 0.4, y: 0.3 }, { x: 0.6, y: 0.3 },
        { x: 0.45, y: 0.6 }, { x: 0.55, y: 0.6 }
      );
    },
  },
  {
    name: "MA-03 边界 deviation=0.1 → 不歪斜",
    expect: false,
    fn: function() {
      return detectMisalignment(
        { x: 0.6, y: 0.1 },
        { x: 0.4, y: 0.3 }, { x: 0.6, y: 0.3 },
        { x: 0.45, y: 0.6 }, { x: 0.55, y: 0.6 }
      );
    },
  },

  // SC-01~05: 综合评分
  {
    name: "SC-01 完美姿势 → score=100, issues=[]",
    expect: { score: 100, issuesLen: 0 },
    fn: function() {
      return scorePosture(makeLandmarks({}));
    },
  },
  {
    name: "SC-02 headForward only → score=75, issues=[headForward]",
    expect: { score: 75, issuesLen: 1 },
    fn: function() {
      return scorePosture(makeLandmarks({
        7: { x: 0.6, y: 0.28 }, 8: { x: 0.7, y: 0.28 }
      }));
    },
  },
  {
    name: "SC-03 headForward+hunchback → score=55, issues=2",
    expect: { score: 55, issuesLen: 2 },
    fn: function() {
      return scorePosture(makeLandmarks({
        7:  { x: 0.6, y: 0.28 }, 8:  { x: 0.7, y: 0.28 },
        11: { x: 0.35, y: 0.2 }, 12: { x: 0.65, y: 0.3 },
      }));
    },
  },
  {
    name: "SC-04 全触发 → score=40, issues=3",
    expect: { score: 40, issuesLen: 3 },
    fn: function() {
      return scorePosture(makeLandmarks({
        0:  { x: 0.75, y: 0.1 },
        7:  { x: 0.7,  y: 0.28 }, 8:  { x: 0.8, y: 0.28 },
        11: { x: 0.35, y: 0.2 }, 12: { x: 0.65, y: 0.3 },
      }));
    },
  },
  {
    name: "SC-05 极差姿势 → score=40 (扣25+20+15=60), issues=3",
    expect: { score: 40, issuesLen: 3 },
    fn: function() {
      return scorePosture(makeLandmarks({
        0:  { x: 1.0, y: 0.1 },
        7:  { x: 0.9,  y: 0.4 }, 8:  { x: 1.0, y: 0.4 },
        11: { x: 0.2,  y: 0.1 }, 12: { x: 0.8, y: 0.3 },
      }));
    },
  },
];

// ── 运行测试 ─────────────────────────────────────────

var passed = 0;
var failed = 0;

console.log("\n\x1b[36m═══ PostureDetector 单元测试 ═══\x1b[0m\n");

for (var i = 0; i < TESTS.length; i++) {
  var t = TESTS[i];
  var result;
  try {
    result = t.fn();
  } catch (e) {
    console.log("  \x1b[31m✗ " + t.name + "\x1b[0m  → " + e.message);
    failed++;
    continue;
  }

  var ok;
  if (typeof t.expect === "boolean") {
    ok = result === t.expect;
  } else if (typeof t.expect === "object") {
    ok = result.score === t.expect.score && result.issues.length === t.expect.issuesLen;
  }

  if (ok) {
    console.log("  \x1b[32m✓\x1b[0m " + t.name);
    passed++;
  } else {
    console.log("  \x1b[31m✗\x1b[0m " + t.name + "  → got score=" + result.score + " issues=" + JSON.stringify(result.issues));
    failed++;
  }
}

console.log("\x1b[36m" + "═".repeat(50) + "\x1b[0m");
console.log("结果: \x1b[32m" + passed + " 通过\x1b[0m / \x1b[31m" + failed + " 失败\x1b[0m\n");

if (failed > 0) {
  require("child_process").exec("exit 1");
}
