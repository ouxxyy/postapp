#!/usr/bin/env node
/**
 * PostureDetector 单元测试（纯 JavaScript）
 *
 * 这里复刻 src/lib/PostureDetector.ts 中的比例化上半身几何逻辑，
 * 重点验证头前倾、含胸驼背、坐姿偏斜和综合评分。
 */

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

function clampSeverity(value) {
  return Math.max(0, Math.min(1, value));
}

function averagePoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function makePose(overrides) {
  const pose = {
    nose: { x: 0.5, y: 0.1 },
    leftEar: { x: 0.48, y: 0.05 },
    rightEar: { x: 0.52, y: 0.05 },
    leftShoulder: { x: 0.4, y: 0.3 },
    rightShoulder: { x: 0.6, y: 0.3 },
    leftHip: { x: 0.45, y: 0.6 },
    rightHip: { x: 0.55, y: 0.6 },
  };

  return Object.assign(pose, overrides || {});
}

function analyzePose(pose) {
  const hasEars = Boolean(pose.leftEar && pose.rightEar);
  const shoulderMid = averagePoint(pose.leftShoulder, pose.rightShoulder);
  const reliableHipPoints = [pose.leftHip, pose.rightHip].filter(
    (hip) =>
      Boolean(hip) &&
      hip.y > shoulderMid.y + 0.12 &&
      Math.abs(hip.x - shoulderMid.x) < 0.38,
  );
  const hasReliableHips = reliableHipPoints.length > 0;
  const earMid = hasEars
    ? averagePoint(pose.leftEar, pose.rightEar)
    : pose.nose;
  const hipMid =
    reliableHipPoints.length >= 2
      ? averagePoint(reliableHipPoints[0], reliableHipPoints[1])
      : reliableHipPoints.length === 1
        ? { x: shoulderMid.x, y: reliableHipPoints[0].y }
        : {
            x: shoulderMid.x,
            y:
              shoulderMid.y +
              Math.max((shoulderMid.y - pose.nose.y) * 2.4, 0.3),
          };

  const shoulderWidth = Math.max(
    Math.abs(pose.leftShoulder.x - pose.rightShoulder.x),
    0.06,
  );
  const torsoHeight = Math.max(Math.abs(hipMid.y - shoulderMid.y), 0.12);
  const neckHeight = Math.max(shoulderMid.y - pose.nose.y, 0);
  const earShoulderVertDist = Math.max(shoulderMid.y - earMid.y, 0);
  const earShoulderHorizDist = Math.abs(earMid.x - shoulderMid.x);
  const headWidth = hasEars
    ? Math.max(Math.abs(pose.leftEar.x - pose.rightEar.x), 0.08)
    : 0.08;
  const shoulderHeightDiff = Math.abs(
    pose.leftShoulder.y - pose.rightShoulder.y,
  );
  const bodyMidX = (shoulderMid.x + hipMid.x) / 2;
  const noseCenterOffset = Math.abs(pose.nose.x - bodyMidX);

  const earShoulderRatio = earShoulderVertDist / torsoHeight;
  const neckToShoulderRatio = neckHeight / shoulderWidth;
  const earToShoulderRatio = earShoulderVertDist / shoulderWidth;
  const headHorizontalRatio = earShoulderHorizDist / shoulderWidth;
  const shoulderHeadWidthRatio = shoulderWidth / headWidth;
  const torsoCompressionRatio = torsoHeight / shoulderWidth;
  const shoulderTiltRatio = shoulderHeightDiff / shoulderWidth;

  const issues = [];
  let score = 100;

  const headForwardSeverity = clampSeverity(
    Math.max(
      (0.42 - neckToShoulderRatio) / 0.12,
      (0.46 - earToShoulderRatio) / 0.18,
      (headHorizontalRatio - 0.3) / 0.22,
    ),
  );
  const headForward =
    headForwardSeverity > 0 &&
    ((neckToShoulderRatio < 0.42 && earToShoulderRatio < 0.54) ||
      headHorizontalRatio > 0.34);
  if (headForward) {
    score -= Math.round(10 + headForwardSeverity * 12);
    issues.push("headForward");
  }

  const torsoCompressionSeverity = hasReliableHips
    ? clampSeverity((1.14 - torsoCompressionRatio) / 0.18)
    : 0;
  const upperBackRoundSeverity = clampSeverity(
    Math.max(
      (0.38 - earToShoulderRatio) / 0.14,
      (0.36 - neckToShoulderRatio) / 0.12,
    ),
  );
  const upperBodyHunchSeverity =
    shoulderHeadWidthRatio < 2.15
      ? clampSeverity(
          Math.max(
            (0.78 - neckToShoulderRatio) / 0.2,
            (0.92 - earToShoulderRatio) / 0.24,
            (2.15 - shoulderHeadWidthRatio) / 0.35,
          ),
        )
      : headForward && shoulderHeadWidthRatio < 2.55
        ? clampSeverity(
            Math.max(
              (0.68 - neckToShoulderRatio) / 0.16,
              (0.84 - earToShoulderRatio) / 0.2,
              (2.55 - shoulderHeadWidthRatio) / 0.4,
            ),
          )
        : 0;
  const hunchbackSeverity = clampSeverity(
    Math.max(
      torsoCompressionSeverity,
      hasReliableHips && headForward ? upperBackRoundSeverity * 0.6 : 0,
      !hasReliableHips ? upperBodyHunchSeverity : 0,
    ),
  );
  const hunchback =
    hunchbackSeverity > 0 &&
    (torsoCompressionSeverity > 0 ||
      (hasReliableHips && headForward && upperBackRoundSeverity > 0.65) ||
      (!hasReliableHips && upperBodyHunchSeverity > 0.72));
  if (hunchback) {
    score -= Math.round(10 + hunchbackSeverity * 14);
    issues.push("hunchback");
  }

  const misalignmentSeverity = clampSeverity(
    Math.max(
      (noseCenterOffset / shoulderWidth - 0.22) / 0.18,
      (noseCenterOffset - 0.06) / 0.06,
      (shoulderTiltRatio - 0.2) / 0.16,
    ),
  );
  const misaligned = misalignmentSeverity > 0;
  if (misaligned) {
    score -= Math.round(8 + misalignmentSeverity * 10);
    issues.push("misaligned");
  }

  return {
    score: clampScore(score),
    issues,
    headForward,
    hunchback,
    misaligned,
  };
}

const TESTS = [
  {
    name: "PF-01 正常坐姿 → 不触发任何问题",
    run: () => analyzePose(makePose()),
    assert: (result) =>
      result.score === 100 &&
      result.issues.length === 0 &&
      !result.headForward &&
      !result.hunchback &&
      !result.misaligned,
  },
  {
    name: "PF-02 头部明显前探 → 识别 headForward",
    run: () =>
      analyzePose(
        makePose({
          nose: { x: 0.5, y: 0.22 },
          leftEar: { x: 0.48, y: 0.24 },
          rightEar: { x: 0.52, y: 0.24 },
        }),
      ),
    assert: (result) =>
      result.score === 79 &&
      result.issues.join(",") === "headForward" &&
      result.headForward,
  },
  {
    name: "PF-03 头部整体前探偏移 → 仍能识别 headForward",
    run: () =>
      analyzePose(
        makePose({
          leftEar: { x: 0.67, y: 0.06 },
          rightEar: { x: 0.77, y: 0.06 },
        }),
      ),
    assert: (result) =>
      result.score === 78 &&
      result.issues.join(",") === "headForward" &&
      result.headForward,
  },
  {
    name: "PF-04 躯干压缩含胸 → 识别 hunchback",
    run: () =>
      analyzePose(
        makePose({
          nose: { x: 0.5, y: 0.2 },
          leftEar: { x: 0.48, y: 0.16 },
          rightEar: { x: 0.52, y: 0.16 },
          leftShoulder: { x: 0.4, y: 0.36 },
          rightShoulder: { x: 0.6, y: 0.36 },
          leftHip: { x: 0.45, y: 0.58 },
          rightHip: { x: 0.55, y: 0.58 },
        }),
      ),
    assert: (result) =>
      result.score === 87 &&
      result.issues.join(",") === "hunchback" &&
      result.hunchback,
  },
  {
    name: "PF-05 肩膀明显一高一低 → 归入 misaligned",
    run: () =>
      analyzePose(
        makePose({
          nose: { x: 0.5, y: 0.08 },
          leftEar: { x: 0.48, y: 0.03 },
          rightEar: { x: 0.52, y: 0.03 },
          leftShoulder: { x: 0.4, y: 0.22 },
          rightShoulder: { x: 0.6, y: 0.32 },
        }),
      ),
    assert: (result) =>
      result.score === 82 &&
      result.issues.join(",") === "misaligned" &&
      result.misaligned,
  },
  {
    name: "PF-06 身体中线明显偏移 → 识别 misaligned",
    run: () =>
      analyzePose(
        makePose({
          nose: { x: 0.68, y: 0.1 },
        }),
      ),
    assert: (result) =>
      result.score === 82 &&
      result.issues.join(",") === "misaligned" &&
      result.misaligned,
  },
  {
    name: "PF-07 头前倾 + 驼背 + 歪斜 → 三项同时触发",
    run: () =>
      analyzePose(
        makePose({
          nose: { x: 0.72, y: 0.24 },
          leftEar: { x: 0.74, y: 0.26 },
          rightEar: { x: 0.84, y: 0.26 },
          leftShoulder: { x: 0.42, y: 0.38 },
          rightShoulder: { x: 0.62, y: 0.4 },
          leftHip: { x: 0.45, y: 0.58 },
          rightHip: { x: 0.55, y: 0.58 },
        }),
      ),
    assert: (result) =>
      result.score === 36 &&
      result.issues.join(",") === "headForward,hunchback,misaligned" &&
      result.headForward &&
      result.hunchback &&
      result.misaligned,
  },
  {
    name: "PF-08 仅拍到上半身且髋部缺失 → 不应稳定误报 hunchback",
    run: () =>
      analyzePose({
        nose: { x: 0.5, y: 0.34 },
        leftEar: { x: 0.46, y: 0.33 },
        rightEar: { x: 0.54, y: 0.33 },
        leftShoulder: { x: 0.39, y: 0.46 },
        rightShoulder: { x: 0.61, y: 0.46 },
      }),
    assert: (result) =>
      result.score === 100 && result.issues.length === 0 && !result.hunchback,
  },
  {
    name: "PF-09 靠近摄像头但髋部缺失 → 不应仅因构图触发问题",
    run: () =>
      analyzePose({
        nose: { x: 0.5, y: 0.42 },
        leftEar: { x: 0.47, y: 0.41 },
        rightEar: { x: 0.53, y: 0.41 },
        leftShoulder: { x: 0.41, y: 0.5 },
        rightShoulder: { x: 0.59, y: 0.5 },
      }),
    assert: (result) =>
      result.score === 100 &&
      result.issues.length === 0 &&
      !result.hunchback &&
      !result.headForward,
  },
  {
    name: "PF-10 单侧髋部可见的含胸驼背 → 仍应识别 hunchback",
    run: () =>
      analyzePose(
        makePose({
          nose: { x: 0.5, y: 0.2 },
          leftEar: { x: 0.48, y: 0.16 },
          rightEar: { x: 0.52, y: 0.16 },
          leftShoulder: { x: 0.4, y: 0.36 },
          rightShoulder: { x: 0.6, y: 0.36 },
          rightHip: { x: 0.55, y: 0.58 },
          leftHip: undefined,
        }),
      ),
    assert: (result) =>
      result.score === 87 &&
      result.issues.join(",") === "hunchback" &&
      result.hunchback,
  },
];

let passed = 0;
let failed = 0;

console.log("\n\x1b[36m═══ PostureDetector 单元测试 ═══\x1b[0m\n");

for (const testCase of TESTS) {
  try {
    const result = testCase.run();
    if (testCase.assert(result)) {
      console.log(`  \x1b[32m✓\x1b[0m ${testCase.name}`);
      passed++;
      continue;
    }

    console.log(
      `  \x1b[31m✗\x1b[0m ${testCase.name} → got score=${result.score} issues=${JSON.stringify(result.issues)}`,
    );
    failed++;
  } catch (error) {
    console.log(
      `  \x1b[31m✗\x1b[0m ${testCase.name} → ${error instanceof Error ? error.message : String(error)}`,
    );
    failed++;
  }
}

console.log(`\x1b[36m${"═".repeat(50)}\x1b[0m`);
console.log(
  `结果: \x1b[32m${passed} 通过\x1b[0m / \x1b[31m${failed} 失败\x1b[0m\n`,
);

if (failed > 0) {
  process.exit(1);
}
