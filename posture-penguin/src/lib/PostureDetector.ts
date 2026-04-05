/**
 * PostureDetector — 使用 TensorFlow.js MoveNet 进行姿势检测
 *
 * 架构决策（2026-04 重写）：
 * 旧方案：@mediapipe/pose
 *   - 内部通过 document.createElement("script") 动态注入 WASM 加载器
 *   - Chrome Extension MV3 的 CSP (script-src 'self') 会拦截动态脚本
 *   - 错误被静默吞掉（error handler 里 resolve 而非 reject），表现为"检测失败"
 *
 * 新方案：@tensorflow-models/pose-detection + MoveNet
 *   - 纯 JS 运行（WebGL backend），不依赖 WASM 加载器
 *   - 不需要动态脚本注入，完全兼容 Extension CSP
 *   - MoveNet SINGLEPOSE_LIGHTNING 速度极快（>50fps），适合实时检测
 *   - 返回 17 个关键点，与 MediaPipe BlazePose 的上半身关键点完全对应
 */

import * as poseDetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-cpu";
import "@tensorflow/tfjs-backend-webgl";
import * as tf from "@tensorflow/tfjs-core";

export interface DetectionResult {
  score: number;
  issues: string[];
  headForward: boolean;
  hunchback: boolean;
  misaligned: boolean;
  landmarks?: { x: number; y: number; z: number }[];
  /** 内部调试数据，可用于 UI 展示或日志 */
  debug?: {
    earShoulderVertDist: number;
    earShoulderHorizDist: number;
    shoulderHeightDiff: number;
    noseCenterOffset: number;
    shoulderWidth: number;
    torsoHeight: number;
    neckHeight: number;
    headWidth: number;
    earShoulderRatio: number;
    neckToShoulderRatio: number;
    earToShoulderRatio: number;
    headHorizontalRatio: number;
    shoulderHeadWidthRatio: number;
    torsoCompressionRatio: number;
    shoulderTiltRatio: number;
    hasReliableHips: boolean;
    keypointConfidences: Record<string, number>;
  };
}

type NormalizedPoint = {
  x: number;
  y: number;
};

export type NormalizedUpperBodyPose = {
  nose: NormalizedPoint;
  leftShoulder: NormalizedPoint;
  rightShoulder: NormalizedPoint;
  leftEar?: NormalizedPoint;
  rightEar?: NormalizedPoint;
  leftHip?: NormalizedPoint;
  rightHip?: NormalizedPoint;
  keypointConfidences?: Record<string, number>;
};

/**
 * MoveNet 关键点名称 → 索引映射（共 17 个）
 * 参考：https://github.com/tensorflow/tfjs-models/tree/master/pose-detection
 */
const KEYPOINT = {
  nose: 0,
  left_eye: 1,
  right_eye: 2,
  left_ear: 3,
  right_ear: 4,
  left_shoulder: 5,
  right_shoulder: 6,
  left_elbow: 7,
  right_elbow: 8,
  left_wrist: 9,
  right_wrist: 10,
  left_hip: 11,
  right_hip: 12,
  left_knee: 13,
  right_knee: 14,
  left_ankle: 15,
  right_ankle: 16,
} as const;

const roundMetric = (value: number): number =>
  Math.round(value * 10000) / 10000;

const clampScore = (value: number): number => Math.max(0, Math.min(100, value));

const clampSeverity = (value: number): number =>
  Math.max(0, Math.min(1, value));

function averagePoint(a: NormalizedPoint, b: NormalizedPoint): NormalizedPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function estimateHipPoint(
  shoulderMid: NormalizedPoint,
  nose: NormalizedPoint,
): NormalizedPoint {
  const inferredTorsoHeight = Math.max((shoulderMid.y - nose.y) * 2.4, 0.3);
  return {
    x: shoulderMid.x,
    y: Math.min(0.98, shoulderMid.y + inferredTorsoHeight),
  };
}

async function ensurePreferredBackend(): Promise<string> {
  await tf.ready();

  for (const backend of ["webgl", "cpu"] as const) {
    if (!tf.findBackend(backend)) {
      continue;
    }

    try {
      const switched = await tf.setBackend(backend);
      if (!switched) {
        continue;
      }
      await tf.ready();
      return backend;
    } catch (error) {
      console.warn(`[PostureDetector] 切换 ${backend} backend 失败:`, error);
    }
  }

  throw new Error("No TensorFlow backend available");
}

export function analyzeNormalizedUpperBodyPose(
  pose: NormalizedUpperBodyPose,
): Omit<DetectionResult, "landmarks"> {
  const {
    nose,
    leftShoulder,
    rightShoulder,
    leftEar,
    rightEar,
    leftHip,
    rightHip,
    keypointConfidences = {},
  } = pose;

  const hasEars = Boolean(leftEar && rightEar);
  const shoulderMid = averagePoint(leftShoulder, rightShoulder);
  const reliableHipPoints = [leftHip, rightHip].filter(
    (hip): hip is NormalizedPoint =>
      Boolean(hip) &&
      (hip as NormalizedPoint).y > shoulderMid.y + 0.12 &&
      Math.abs((hip as NormalizedPoint).x - shoulderMid.x) < 0.38,
  );
  const hasReliableHips = reliableHipPoints.length > 0;
  const earMid = hasEars
    ? averagePoint(leftEar as NormalizedPoint, rightEar as NormalizedPoint)
    : nose;
  const hipMid =
    reliableHipPoints.length >= 2
      ? averagePoint(reliableHipPoints[0], reliableHipPoints[1])
      : reliableHipPoints.length === 1
        ? { x: shoulderMid.x, y: reliableHipPoints[0].y }
        : estimateHipPoint(shoulderMid, nose);

  const shoulderWidth = Math.max(
    Math.abs(leftShoulder.x - rightShoulder.x),
    0.06,
  );
  const torsoHeight = Math.max(Math.abs(hipMid.y - shoulderMid.y), 0.12);
  const neckHeight = Math.max(shoulderMid.y - nose.y, 0);
  const earShoulderVertDist = Math.max(shoulderMid.y - earMid.y, 0);
  const earShoulderHorizDist = Math.abs(earMid.x - shoulderMid.x);
  const headWidth = hasEars
    ? Math.max(
        Math.abs(
          (leftEar as NormalizedPoint).x - (rightEar as NormalizedPoint).x,
        ),
        0.08,
      )
    : 0.08;
  const shoulderHeightDiff = Math.abs(leftShoulder.y - rightShoulder.y);
  const bodyMidX = (shoulderMid.x + hipMid.x) / 2;
  const noseCenterOffset = Math.abs(nose.x - bodyMidX);

  const earShoulderRatio = earShoulderVertDist / torsoHeight;
  const neckToShoulderRatio = neckHeight / shoulderWidth;
  const earToShoulderRatio = earShoulderVertDist / shoulderWidth;
  const headHorizontalRatio = earShoulderHorizDist / shoulderWidth;
  const shoulderHeadWidthRatio = shoulderWidth / headWidth;
  const torsoCompressionRatio = torsoHeight / shoulderWidth;
  const shoulderTiltRatio = shoulderHeightDiff / shoulderWidth;

  const issues: string[] = [];
  let score = 100;

  // ─── 评分改进策略 ───
  // 1. 提高触发阈值，减少误报
  // 2. 渐进式扣分：轻微问题少扣，严重问题多扣
  // 3. 增加"安全区"，忽略微小波动

  // ─── 头前倾检测 ───
  // 提高阈值：neckToShoulderRatio < 0.38（原0.42）才触发
  // 扣分公式改为：5 + severity * 15（原10 + severity * 12）
  const headForwardSeverity = clampSeverity(
    Math.max(
      (0.38 - neckToShoulderRatio) / 0.14,
      (0.42 - earToShoulderRatio) / 0.2,
      (headHorizontalRatio - 0.35) / 0.2,
    ),
  );
  const headForward =
    headForwardSeverity > 0.15 && // 增加安全区，忽略 < 0.15 的微小波动
    ((neckToShoulderRatio < 0.38 && earToShoulderRatio < 0.52) ||
      headHorizontalRatio > 0.4);
  if (headForward) {
    score -= Math.round(5 + headForwardSeverity * 15);
    issues.push("headForward");
  }

  // ─── 驼背检测 ───
  // 简化逻辑：不依赖髋部，使用上半身指标
  // 提高阈值：earToShoulderRatio < 0.34（原0.38）才触发
  const upperBodyHunchSeverity = clampSeverity(
    Math.max(
      (0.34 - earToShoulderRatio) / 0.16,
      (0.32 - neckToShoulderRatio) / 0.14,
      shoulderHeadWidthRatio < 2.0 ? (2.0 - shoulderHeadWidthRatio) / 0.4 : 0,
    ),
  );
  const hunchback =
    upperBodyHunchSeverity > 0.25 && // 增加安全区
    (earToShoulderRatio < 0.4 ||
      neckToShoulderRatio < 0.38 ||
      shoulderHeadWidthRatio < 2.2);
  if (hunchback) {
    score -= Math.round(6 + upperBodyHunchSeverity * 14);
    issues.push("hunchback");
  }

  // ─── 坐姿不正检测 ───
  // 提高阈值，减少误报
  const misalignmentSeverity = clampSeverity(
    Math.max(
      (noseCenterOffset / shoulderWidth - 0.28) / 0.15,
      (noseCenterOffset - 0.08) / 0.05,
      (shoulderTiltRatio - 0.25) / 0.15,
    ),
  );
  const misaligned = misalignmentSeverity > 0.15;
  if (misaligned) {
    score -= Math.round(4 + misalignmentSeverity * 12);
    issues.push("misaligned");
  }

  return {
    score: clampScore(score),
    issues,
    headForward,
    hunchback,
    misaligned,
    debug: {
      earShoulderVertDist: roundMetric(earShoulderVertDist),
      earShoulderHorizDist: roundMetric(earShoulderHorizDist),
      shoulderHeightDiff: roundMetric(shoulderHeightDiff),
      noseCenterOffset: roundMetric(noseCenterOffset),
      shoulderWidth: roundMetric(shoulderWidth),
      torsoHeight: roundMetric(torsoHeight),
      neckHeight: roundMetric(neckHeight),
      headWidth: roundMetric(headWidth),
      earShoulderRatio: roundMetric(earShoulderRatio),
      neckToShoulderRatio: roundMetric(neckToShoulderRatio),
      earToShoulderRatio: roundMetric(earToShoulderRatio),
      headHorizontalRatio: roundMetric(headHorizontalRatio),
      shoulderHeadWidthRatio: roundMetric(shoulderHeadWidthRatio),
      torsoCompressionRatio: roundMetric(torsoCompressionRatio),
      shoulderTiltRatio: roundMetric(shoulderTiltRatio),
      hasReliableHips,
      keypointConfidences,
    },
  };
}

class PostureDetector {
  private detector: poseDetection.PoseDetector | null = null;
  private initState: "idle" | "pending" | "ready" | "error" = "idle";
  private initPromise: Promise<void> | null = null;

  /**
   * 初始化 MoveNet 检测器
   * 使用 SINGLEPOSE_LIGHTNING（最快）并启用时序平滑
   */
  async init(): Promise<void> {
    if (this.initState === "ready") return;
    if (this.initState === "pending" && this.initPromise)
      return this.initPromise;
    if (this.initState === "error") {
      // 重置使其可以重试
      this.initState = "idle";
    }

    this.initState = "pending";
    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    try {
      console.log("[PostureDetector] 初始化 TF.js backend...");
      const backend = await ensurePreferredBackend();
      console.log("[PostureDetector] TF.js backend 就绪:", backend);

      console.log(
        "[PostureDetector] 创建 MoveNet SINGLEPOSE_LIGHTNING detector...",
      );
      this.detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          enableSmoothing: true,
        },
      );

      this.initState = "ready";
      console.log("[PostureDetector] MoveNet 初始化完成 ✅");
    } catch (err) {
      this.initState = "error";
      this.detector = null;
      console.error("[PostureDetector] 初始化失败:", err);
      throw err;
    }
  }

  /**
   * 对单帧图像做姿势检测
   * @param image HTMLCanvasElement 或 HTMLVideoElement
   */
  async detect(
    image: HTMLCanvasElement | HTMLVideoElement,
  ): Promise<DetectionResult> {
    // 确保已初始化
    if (this.initState !== "ready") {
      await this.init();
    }

    if (!this.detector) {
      throw new Error("Pose detector not initialized");
    }

    // MoveNet.estimatePoses 是同步-异步的，直接返回 Promise
    const poses = await this.detector.estimatePoses(image);

    console.log("[PostureDetector] estimatePoses 返回:", {
      posesCount: poses?.length ?? 0,
      firstPoseKeypoints: poses?.[0]?.keypoints?.length ?? 0,
    });

    if (!poses || poses.length === 0 || !poses[0].keypoints) {
      return {
        score: 0,
        issues: ["noPoseDetected"],
        headForward: false,
        hunchback: false,
        misaligned: false,
      };
    }

    // 打印所有关键点的置信度以便调试
    const kpDebug: Record<string, number> = {};
    poses[0].keypoints.forEach((kp, idx) => {
      const name = Object.keys(KEYPOINT).find(
        (k) => KEYPOINT[k as keyof typeof KEYPOINT] === idx,
      );
      kpDebug[name ?? `kp_${idx}`] = Math.round((kp.score ?? 0) * 100) / 100;
    });
    console.log("[PostureDetector] 关键点置信度:", kpDebug);

    return this.analyzeKeypoints(poses[0].keypoints, image);
  }

  /**
   * 分析关键点，返回姿势评分
   * MoveNet keypoints 的 x/y 是像素坐标，需要归一化
   */
  private analyzeKeypoints(
    keypoints: poseDetection.Keypoint[],
    image: HTMLCanvasElement | HTMLVideoElement,
  ): DetectionResult {
    const width = "videoWidth" in image ? image.videoWidth : image.width;
    const height = "videoHeight" in image ? image.videoHeight : image.height;

    if (width === 0 || height === 0) {
      return {
        score: 0,
        issues: ["noPoseDetected"],
        headForward: false,
        hunchback: false,
        misaligned: false,
      };
    }

    // 置信度阈值：自动检测场景下用户姿势不一定理想（侧身、光线差等），适当降低门槛
    const minConfidence = 0.15; // 核心关键点（鼻子）
    const shoulderConfidence = 0.12; // 肩膀：至少一侧达标即可
    const earConfidence = 0.12;
    const hipConfidence = 0.08;
    const nose = keypoints[KEYPOINT.nose];
    const leftEar = keypoints[KEYPOINT.left_ear];
    const rightEar = keypoints[KEYPOINT.right_ear];
    let leftShoulder = keypoints[KEYPOINT.left_shoulder];
    let rightShoulder = keypoints[KEYPOINT.right_shoulder];
    const leftHip = keypoints[KEYPOINT.left_hip];
    const rightHip = keypoints[KEYPOINT.right_hip];

    // 核心判定：鼻子必须有效 + 至少一侧肩膀有效
    const noseValid = nose && (nose.score ?? 0) >= minConfidence;
    const leftShoulderValid =
      leftShoulder && (leftShoulder.score ?? 0) >= shoulderConfidence;
    const rightShoulderValid =
      rightShoulder && (rightShoulder.score ?? 0) >= shoulderConfidence;
    const hasValidPose = noseValid && (leftShoulderValid || rightShoulderValid);

    if (!hasValidPose) {
      const scores = [
        { name: "nose", score: Math.round((nose?.score ?? 0) * 100) / 100 },
        {
          name: "L_shoulder",
          score: Math.round((leftShoulder?.score ?? 0) * 100) / 100,
        },
        {
          name: "R_shoulder",
          score: Math.round((rightShoulder?.score ?? 0) * 100) / 100,
        },
      ];
      const scoreStr = scores.map((s) => `${s.name}=${s.score}`).join(", ");
      console.warn(
        `[PostureDetector] 关键点置信度不足 (鼻子阈值=${minConfidence}, 肩膀阈值=${shoulderConfidence}): ${scoreStr}`,
      );
      return {
        score: 0,
        issues: ["lowConfidence"],
        headForward: false,
        hunchback: false,
        misaligned: false,
      };
    }

    // 只有一侧肩膀有效时，用有效的一侧镜像估算另一侧
    if (leftShoulderValid && !rightShoulderValid) {
      console.log("[PostureDetector] 右肩置信度不足，使用左肩镜像估算");
      rightShoulder = {
        ...leftShoulder,
        x: nose.x + (nose.x - leftShoulder.x), // 以鼻子为中心镜像
        score: leftShoulder.score,
      };
    } else if (rightShoulderValid && !leftShoulderValid) {
      console.log("[PostureDetector] 左肩置信度不足，使用右肩镜像估算");
      leftShoulder = {
        ...rightShoulder,
        x: nose.x + (nose.x - rightShoulder.x), // 以鼻子为中心镜像
        score: rightShoulder.score,
      };
    }

    // 归一化坐标到 0-1 范围
    const norm = (kp: poseDetection.Keypoint) => ({
      x: kp.x / width,
      y: kp.y / height,
    });

    const normalizedAnalysis = analyzeNormalizedUpperBodyPose({
      nose: norm(nose),
      leftShoulder: norm(leftShoulder),
      rightShoulder: norm(rightShoulder),
      leftEar:
        (leftEar?.score ?? 0) >= earConfidence ? norm(leftEar) : undefined,
      rightEar:
        (rightEar?.score ?? 0) >= earConfidence ? norm(rightEar) : undefined,
      leftHip:
        (leftHip?.score ?? 0) >= hipConfidence ? norm(leftHip) : undefined,
      rightHip:
        (rightHip?.score ?? 0) >= hipConfidence ? norm(rightHip) : undefined,
      keypointConfidences: Object.fromEntries(
        Object.entries(KEYPOINT).map(([name, idx]) => [
          name,
          Math.round((keypoints[idx]?.score ?? 0) * 100) / 100,
        ]),
      ),
    });

    console.log("[PostureDetector] 姿势关键指标:", normalizedAnalysis.debug);
    console.log("[PostureDetector] 评分结果:", {
      score: normalizedAnalysis.score,
      issues: normalizedAnalysis.issues,
      headForward: normalizedAnalysis.headForward,
      hunchback: normalizedAnalysis.hunchback,
      misaligned: normalizedAnalysis.misaligned,
    });

    // 转换为统一的 landmarks 格式供绘制骨架使用
    const landmarks = this.keypointsToLandmarks(keypoints, width, height);

    return {
      ...normalizedAnalysis,
      landmarks,
    };
  }

  /**
   * 将 MoveNet 17 keypoints 转换为归一化 landmarks 数组
   * 保持与 drawPose() 的 BlazePose 索引兼容
   */
  private keypointsToLandmarks(
    keypoints: poseDetection.Keypoint[],
    width: number,
    height: number,
  ): { x: number; y: number; z: number }[] {
    // MoveNet 索引 → BlazePose 索引映射
    // BlazePose: 0=nose, 7=left_ear, 8=right_ear, 11=left_shoulder, 12=right_shoulder, 23=left_hip, 24=right_hip
    // MoveNet:   0=nose, 3=left_ear, 4=right_ear, 5=left_shoulder, 6=right_shoulder, 11=left_hip, 12=right_hip
    const blazeMap: Record<number, number> = {
      0: 0, // nose
      7: 3, // left_ear
      8: 4, // right_ear
      11: 5, // left_shoulder → MoveNet idx 5
      12: 6, // right_shoulder → MoveNet idx 6
      13: 7, // left_elbow
      14: 8, // right_elbow
      23: 11, // left_hip
      24: 12, // right_hip
    };

    // 创建一个足够大的数组兼容 BlazePose 索引（最大 24）
    const result: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i <= 24; i++) {
      const moveNetIdx = blazeMap[i];
      if (moveNetIdx !== undefined && moveNetIdx < keypoints.length) {
        const kp = keypoints[moveNetIdx];
        result.push({
          x: kp.x / width,
          y: kp.y / height,
          z: 0,
        });
      } else {
        result.push({ x: 0, y: 0, z: 0 });
      }
    }
    return result;
  }

  destroy(): void {
    if (this.detector) {
      this.detector.dispose();
      this.detector = null;
      this.initState = "idle";
      this.initPromise = null;
    }
  }
}

export default PostureDetector;
