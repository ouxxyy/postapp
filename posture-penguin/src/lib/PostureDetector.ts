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
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";

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
    keypointConfidences: Record<string, number>;
  };
}

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
    if (this.initState === "pending" && this.initPromise) return this.initPromise;
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

      // 强制使用 webgl backend（Chrome Extension popup 中 webgpu 不可用）
      await tf.setBackend("webgl");
      await tf.ready();
      console.log("[PostureDetector] TF.js backend 就绪:", tf.getBackend());

      console.log("[PostureDetector] 创建 MoveNet SINGLEPOSE_LIGHTNING detector...");
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

    // 检查关键点置信度 — 降低到 0.2 以兼容光线不好的场景
    const minConfidence = 0.2;
    const nose = keypoints[KEYPOINT.nose];
    const leftEar = keypoints[KEYPOINT.left_ear];
    const rightEar = keypoints[KEYPOINT.right_ear];
    const leftShoulder = keypoints[KEYPOINT.left_shoulder];
    const rightShoulder = keypoints[KEYPOINT.right_shoulder];
    const leftHip = keypoints[KEYPOINT.left_hip];
    const rightHip = keypoints[KEYPOINT.right_hip];

    // 检查核心关键点（鼻子 + 双肩）是否有足够置信度
    const corePoints = [nose, leftShoulder, rightShoulder];
    const hasValidPose = corePoints.every(
      (kp) => kp && (kp.score ?? 0) >= minConfidence,
    );

    if (!hasValidPose) {
      const scores = corePoints.map((kp) => ({
        name: kp === nose ? "nose" : kp === leftShoulder ? "L_shoulder" : "R_shoulder",
        score: kp?.score ?? 0,
      }));
      console.warn("[PostureDetector] 关键点置信度不足:", scores);
      return {
        score: 0,
        issues: ["lowConfidence"],
        headForward: false,
        hunchback: false,
        misaligned: false,
      };
    }

    // 归一化坐标到 0-1 范围
    const norm = (kp: poseDetection.Keypoint) => ({
      x: kp.x / width,
      y: kp.y / height,
    });

    const nNose = norm(nose);
    const nLeftEar = norm(leftEar);
    const nRightEar = norm(rightEar);
    const nLeftShoulder = norm(leftShoulder);
    const nRightShoulder = norm(rightShoulder);
    const nLeftHip = norm(leftHip);
    const nRightHip = norm(rightHip);

    // 检查耳朵和臀部的置信度（用于头前倾和坐姿判断）
    const hasEars =
      (leftEar?.score ?? 0) >= minConfidence &&
      (rightEar?.score ?? 0) >= minConfidence;
    const hasHips =
      (leftHip?.score ?? 0) >= minConfidence &&
      (rightHip?.score ?? 0) >= minConfidence;

    const issues: string[] = [];
    let score = 100;

    // ─── 调试数据收集 ───
    const earMidX = hasEars ? (nLeftEar.x + nRightEar.x) / 2 : nNose.x;
    const earMidY = hasEars ? (nLeftEar.y + nRightEar.y) / 2 : nNose.y;
    const shoulderMidX = (nLeftShoulder.x + nRightShoulder.x) / 2;
    const shoulderMidY = (nLeftShoulder.y + nRightShoulder.y) / 2;
    const earShoulderVertDist = shoulderMidY - earMidY;
    const earShoulderHorizDist = Math.abs(earMidX - shoulderMidX);
    const shoulderHeightDiff = Math.abs(nLeftShoulder.y - nRightShoulder.y);

    const hipMidX = hasHips ? (nLeftHip.x + nRightHip.x) / 2 : shoulderMidX;
    const bodyMidX = (shoulderMidX + hipMidX) / 2;
    const noseCenterOffset = Math.abs(nNose.x - bodyMidX);

    console.log("[PostureDetector] 姿势关键指标:", {
      earShoulderVertDist: earShoulderVertDist.toFixed(4),
      earShoulderHorizDist: earShoulderHorizDist.toFixed(4),
      shoulderHeightDiff: shoulderHeightDiff.toFixed(4),
      noseCenterOffset: noseCenterOffset.toFixed(4),
      hasEars,
      hasHips,
    });

    // ─── 1. 检测头前倾（仅在耳朵置信度足够时检测）───
    let headForward = false;
    if (hasEars) {
      // 阈值说明（归一化坐标，基于 640x480 视频）：
      // 正常坐姿：耳肩垂直距离 ≈ 0.12~0.22，水平偏移 < 0.05
      // 头前倾：  垂直距离显著减小（< 0.08），或水平偏移增大（> 0.06）
      if (earShoulderVertDist < 0.08) {
        headForward = true;
        // 渐进式扣分：越严重扣分越多
        const severity = Math.max(0, 0.08 - earShoulderVertDist) / 0.08;
        score -= Math.round(15 + severity * 15); // 15~30 分
      } else if (earShoulderHorizDist > 0.06) {
        headForward = true;
        score -= 15;
      }
    }
    if (headForward) issues.push("headForward");

    // ─── 2. 检测驼背（肩膀高度差）───
    // 正常坐姿：双肩高度差 < 0.025（归一化）
    // 驼背倾向：> 0.035（自然偏差在 0.01~0.025 之间）
    let hunchback = false;
    if (shoulderHeightDiff > 0.035) {
      hunchback = true;
      const severity = Math.min(1, (shoulderHeightDiff - 0.035) / 0.04);
      score -= Math.round(10 + severity * 15); // 10~25 分
      issues.push("hunchback");
    }

    // ─── 3. 检测坐姿不正（鼻子偏离身体中线）───
    let misaligned = false;
    if (noseCenterOffset > 0.08) {
      misaligned = true;
      const severity = Math.min(1, (noseCenterOffset - 0.08) / 0.08);
      score -= Math.round(8 + severity * 12); // 8~20 分
      issues.push("misaligned");
    }

    score = Math.max(0, Math.min(100, score));

    console.log("[PostureDetector] 评分结果:", {
      score,
      issues,
      headForward,
      hunchback,
      misaligned,
    });

    // 转换为统一的 landmarks 格式供绘制骨架使用
    const landmarks = this.keypointsToLandmarks(keypoints, width, height);

    return {
      score,
      issues,
      headForward,
      hunchback,
      misaligned,
      landmarks,
      debug: {
        earShoulderVertDist,
        earShoulderHorizDist,
        shoulderHeightDiff,
        noseCenterOffset,
        keypointConfidences: Object.fromEntries(
          Object.entries(KEYPOINT).map(([name, idx]) => [
            name,
            Math.round((keypoints[idx]?.score ?? 0) * 100) / 100,
          ]),
        ),
      },
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
      0: 0,   // nose
      7: 3,   // left_ear
      8: 4,   // right_ear
      11: 5,  // left_shoulder → MoveNet idx 5
      12: 6,  // right_shoulder → MoveNet idx 6
      13: 7,  // left_elbow
      14: 8,  // right_elbow
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
