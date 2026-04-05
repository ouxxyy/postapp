import React, { useRef, useEffect, useState, useCallback } from "react";
import { useAppContext } from "../hooks/useAppContext";
import PostureDetector from "../lib/PostureDetector";
import {
  getSharedPostureDetector,
  isSharedPostureDetectorReady,
  preloadSharedPostureDetector,
} from "../lib/sharedPostureDetector";
import styles from "./DetectionPage.module.css";

interface DetectionPageProps {
  onBack: () => void;
}

// ─── 纯函数辅助（无状态依赖，提到组件外避免每次渲染重建）──────────────

function getPostureMessage(issueList: string[]): string {
  if (issueList.length === 0) return "姿势良好，继续保持！";
  if (issueList.length === 1) {
    switch (issueList[0]) {
      case "headForward":
        return "亲，你的头有点前倾哦～试着把脖子收回来一点";
      case "hunchback":
        return "你有点含胸驼背啦，肩膀向后打开一点，胸口轻轻抬起";
      case "misaligned":
        return "身体有点偏向一侧，或者双肩不太平衡，试着回到正中并放松双肩";
      case "noPoseDetected":
        return "没有检测到姿势，请确保摄像头对准上半身";
      case "lowConfidence":
        return "画面不够清晰，请调整光线或摄像头位置";
      default:
        return "注意保持良好坐姿哦～";
    }
  }
  return `发现几个小问题：${issueList
    .map((i) => {
      switch (i) {
        case "headForward":
          return "头前倾";
        case "hunchback":
          return "驼背";
        case "misaligned":
          return "偏向一侧/双肩不平衡";
        default:
          return i;
      }
    })
    .join("、")}，调整一下吧～`;
}

function drawPose(
  ctx: CanvasRenderingContext2D,
  landmarks: { x: number; y: number; z: number }[],
  score: number,
): void {
  const color = score >= 70 ? "#7DD3A8" : "#F5A3B5";
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  // 绘制关键点（跳过坐标为 0,0 的占位点）
  landmarks.forEach((pt) => {
    if (pt.x === 0 && pt.y === 0) return;
    ctx.beginPath();
    ctx.arc(pt.x * W, pt.y * H, 5, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // 绘制骨架连接线
  const connections = [
    [11, 12], // 肩膀
    [11, 13], // 左上臂
    [12, 14], // 右上臂
    [11, 23], // 左侧躯干
    [12, 24], // 右侧躯干
    [23, 24], // 臀部
  ];
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  connections.forEach(([i, j]) => {
    const p1 = landmarks[i];
    const p2 = landmarks[j];
    if (
      p1 &&
      p2 &&
      !(p1.x === 0 && p1.y === 0) &&
      !(p2.x === 0 && p2.y === 0)
    ) {
      ctx.beginPath();
      ctx.moveTo(p1.x * W, p1.y * H);
      ctx.lineTo(p2.x * W, p2.y * H);
      ctx.stroke();
    }
  });
}

function getScoreColor(score: number): string {
  if (score >= 90) return "var(--color-success)";
  if (score >= 70) return "var(--color-accent)";
  if (score >= 50) return "var(--color-warning)";
  return "var(--color-danger)";
}

function getScoreEmoji(score: number): string {
  if (score >= 90) return "🎉";
  if (score >= 70) return "✅";
  if (score >= 50) return "⚠️";
  return "😟";
}

function shouldPersistDetectionResult(result: {
  score: number;
  issues: string[];
}): boolean {
  if (result.score <= 0) return false;
  if (result.issues.includes("noPoseDetected")) return false;
  if (result.issues.includes("lowConfidence")) return false;
  return true;
}

// ─── 组件 ───────────────────────────────────────────────────────────────

const DetectionPage: React.FC<DetectionPageProps> = ({ onBack }) => {
  /**
   * 架构说明（2026-04 修复 v2）：
   * 摄像头生命周期：按需开启 → 采帧 → 关闭（一次性快照模式）
   * 不在组件 mount 时打开摄像头，而是点击「开始检测」时才打开
   * 避免摄像头指示灯常亮
   */

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<PostureDetector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 状态：idle → modelLoading → cameraReady → detecting → done
  type DetectionPhase =
    | "idle"
    | "modelLoading"
    | "cameraReady"
    | "detecting"
    | "done";
  const [phase, setPhase] = useState<DetectionPhase>("idle");
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(() =>
    isSharedPostureDetectorReady(),
  );

  const { addPostureRecord, showAlert } = useAppContext();

  /** 停止摄像头流并释放硬件资源 */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // ── 预加载模型（组件 mount 时立即开始，不开摄像头）──────────────
  useEffect(() => {
    let cancelled = false;

    const preloadModel = async () => {
      try {
        detectorRef.current = getSharedPostureDetector();
        if (!detectorRef.current) {
          setPhase("modelLoading");
          detectorRef.current = await preloadSharedPostureDetector();
        }
        if (cancelled) return;
        setModelReady(true);
        setPhase((currentPhase) =>
          currentPhase === "modelLoading" ? "idle" : currentPhase,
        );
        console.log("[DetectionPage] 模型预加载完成 ✅");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[DetectionPage] 模型加载失败:", msg);
        setError(`模型加载失败: ${msg}`);
        setPhase("idle");
      }
    };
    preloadModel();

    return () => {
      cancelled = true;
      // 页面离开时只释放摄像头，模型保留在 popup 生命周期内复用
      stopCamera();
      detectorRef.current = null;
    };
  }, [stopCamera]);

  /** 开启摄像头 */
  const startCamera = useCallback(async (): Promise<boolean> => {
    // 先查权限状态
    let permState = "granted";
    try {
      const perm = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });
      permState = perm.state;
    } catch {
      permState = "granted";
    }

    if (permState === "denied") {
      setError("摄像头权限已被拒绝，请在 Chrome 设置 → 隐私设置中手动允许");
      return false;
    }

    if (permState === "prompt") {
      chrome.tabs.create({
        url: chrome.runtime.getURL("popup.html?requestCamera=true"),
      });
      setError("请在弹出的授权页面中点击「允许」，完成后重新打开手动检测");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      return true;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "UnknownError";
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[DetectionPage] Camera error [${name}]: ${msg}`);
      stopCamera();

      switch (name) {
        case "NotAllowedError":
          chrome.tabs.create({
            url: chrome.runtime.getURL("popup.html?requestCamera=true"),
          });
          setError("摄像头权限已失效，请在弹出页面重新授权");
          break;
        case "NotFoundError":
          setError("未找到摄像头设备，请检查连接");
          break;
        case "NotReadableError":
          setError("摄像头正被其他程序占用，请关闭后重试");
          break;
        default:
          setError(`摄像头错误（${name}）：${msg}`);
      }
      return false;
    }
  }, [stopCamera]);

  // ── 完整检测流程：开启摄像头 → 等稳定 → 推理 → 关闭摄像头 → 展示结果 ──
  const detect = useCallback(async () => {
    if (phase === "detecting" || phase === "cameraReady") return;

    setError(null);
    setCurrentScore(null);
    setIssues([]);

    // 1. 确保模型就绪
    if (!detectorRef.current || !modelReady) {
      try {
        setPhase("modelLoading");
        detectorRef.current = await preloadSharedPostureDetector();
        setModelReady(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`模型加载失败: ${msg}`);
        setPhase("idle");
        return;
      }
    }

    // 2. 开启摄像头
    setPhase("cameraReady");
    const cameraOk = await startCamera();
    if (!cameraOk) {
      setPhase("idle");
      return;
    }

    // 3. 等待摄像头画面稳定（给自动曝光/对焦 1 秒时间）
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. 执行检测
    setPhase("detecting");

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        setError("视频元素未就绪");
        setPhase("idle");
        stopCamera();
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx || !video.videoWidth) {
        setError("摄像头画面未就绪，请稍候重试");
        setPhase("idle");
        stopCamera();
        return;
      }

      console.log("[DetectionPage] 开始姿势检测...");
      const result = await detectorRef.current!.detect(video);
      console.log("[DetectionPage] 检测完成:", result);

      // 5. 将最后一帧画面绘制到 canvas（用于显示静帧 + 骨架叠加）
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // 6. 关闭摄像头（不再需要）
      stopCamera();

      // 7. 设置结果
      setCurrentScore(result.score);
      setIssues(result.issues);

      // 在 canvas 上叠加姿势骨架
      if (result.landmarks) {
        drawPose(ctx, result.landmarks, result.score);
      }

      // 保存检测记录（无有效人体姿势时不纳入统计）
      if (shouldPersistDetectionResult(result)) {
        try {
          await addPostureRecord({
            score: result.score,
            issues: result.issues,
            headForward: result.headForward,
            hunchback: result.hunchback,
            misaligned: result.misaligned,
          });
        } catch (recordErr) {
          console.warn("[DetectionPage] 保存记录失败:", recordErr);
        }
      }

      // 姿势有问题时触发提醒
      if (result.score < 70 && shouldPersistDetectionResult(result)) {
        showAlert(
          getPostureMessage(result.issues),
          result.score,
          result.issues,
        );
      }

      setPhase("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[DetectionPage] Detection error:", msg, err);
      stopCamera();
      setError(`姿势检测失败：${msg}`);
      setPhase("idle");
    }
  }, [phase, modelReady, startCamera, stopCamera, addPostureRecord, showAlert]);

  /** 重新检测：重置状态并重新走一遍流程 */
  const redetect = useCallback(() => {
    setCurrentScore(null);
    setIssues([]);
    setError(null);
    setPhase("idle");
    // 延迟一帧后自动触发检测
    requestAnimationFrame(() => detect());
  }, [detect]);

  // ── JSX ─────────────────────────────────────────────────────────────
  const isWorking =
    phase === "modelLoading" ||
    phase === "cameraReady" ||
    phase === "detecting";

  return (
    <div className={styles.container}>
      {/* 顶部导航 */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          ← 返回
        </button>
        <span className={styles.title}>姿势检测</span>
        <div style={{ width: 60 }} />
      </div>

      {/* 摄像头 / 结果区域 */}
      <div className={styles.cameraSection}>
        <div className={styles.videoWrapper}>
          {/* 实时视频预览（仅在摄像头开启期间显示） */}
          <video
            ref={videoRef}
            muted
            playsInline
            style={{
              display:
                phase === "cameraReady" || phase === "detecting"
                  ? "block"
                  : "none",
              width: "100%",
              borderRadius: "12px",
              transform: "scaleX(-1)",
            }}
          />

          {/* 检测结果帧（检测完成后显示带骨架的静帧） */}
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            style={{ display: phase === "done" ? "block" : "none" }}
          />

          {/* 初始化 / 检测中状态提示 */}
          {phase === "modelLoading" && (
            <div className={styles.loadingOverlay}>
              <div className={styles.loadingSpinner} />
              <span>正在加载检测模型...</span>
            </div>
          )}
          {phase === "cameraReady" && (
            <div className={styles.loadingOverlay}>
              <div className={styles.loadingSpinner} />
              <span>正在初始化摄像头...</span>
            </div>
          )}
          {phase === "detecting" && (
            <div className={styles.loadingOverlay}>
              <div className={styles.loadingSpinner} />
              <span>正在分析姿势...</span>
            </div>
          )}

          {/* 待机画面（未开始时） */}
          {phase === "idle" && !error && (
            <div className={styles.idleOverlay}>
              <span className={styles.idleEmoji}>🐧</span>
              <span className={styles.idleText}>
                {modelReady ? "点击下方按钮开始检测" : "正在准备检测模型..."}
              </span>
            </div>
          )}

          {/* 分数浮层（仅在检测完成后） */}
          {phase === "done" && currentScore !== null && (
            <div
              className={styles.scoreOverlay}
              style={
                {
                  "--score-color": getScoreColor(currentScore),
                } as React.CSSProperties
              }
            >
              <span className={styles.scoreNumber}>{currentScore}</span>
              <span className={styles.scoreUnit}>分</span>
            </div>
          )}

          {/* 企鹅角标装饰 */}
          {phase !== "idle" && (
            <div className={styles.penguinCorner}>
              <span className={styles.penguinEmoji}>🐧</span>
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && <div className={styles.errorBanner}>⚠️ {error}</div>}
      </div>

      {/* 检测结果详情 */}
      {phase === "done" && currentScore !== null && (
        <div className={styles.resultSection}>
          <div className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <span className={styles.resultTitle}>检测结果</span>
              <span
                className={styles.resultScore}
                style={{ color: getScoreColor(currentScore) }}
              >
                {getScoreEmoji(currentScore)} {currentScore}分
              </span>
            </div>
            {issues.length > 0 &&
            !issues.includes("noPoseDetected") &&
            !issues.includes("lowConfidence") ? (
              <ul className={styles.issuesList}>
                {issues.map((issue, idx) => (
                  <li key={idx} className={styles.issueItem}>
                    {issue === "headForward" &&
                      "🔺 头部前倾 — 试着把脖子收回来"}
                    {issue === "hunchback" &&
                      "🔶 含胸驼背 — 肩膀向后打开，胸口微微抬起"}
                    {issue === "misaligned" &&
                      "↔️ 坐姿偏歪/双肩不平衡 — 身体回到正中，双肩放松对齐"}
                  </li>
                ))}
              </ul>
            ) : issues.includes("noPoseDetected") ||
              issues.includes("lowConfidence") ? (
              <p className={styles.noDetection}>
                💡 {getPostureMessage(issues)}
              </p>
            ) : (
              <p className={styles.goodPosture}>🎉 姿势很棒，继续保持！</p>
            )}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className={styles.actionSection}>
        {phase === "done" ? (
          <button className={styles.detectBtn} onClick={redetect}>
            <span>🔄</span>
            <span>重新检测</span>
          </button>
        ) : (
          <button
            className={styles.detectBtn}
            onClick={detect}
            disabled={isWorking}
          >
            {isWorking ? (
              <>
                <span className={styles.detectingSpinner} />
                <span>
                  {phase === "modelLoading"
                    ? "加载模型中..."
                    : phase === "cameraReady"
                      ? "开启摄像头..."
                      : "检测中..."}
                </span>
              </>
            ) : (
              <>
                <span>📷</span>
                <span>开始检测</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* 隐私声明 */}
      <div className={styles.privacyNotice}>
        <span className={styles.privacyIcon}>🔒</span>
        <span className={styles.privacyText}>
          所有图像处理均在本地完成，不会上传到服务器
        </span>
      </div>
    </div>
  );
};

export default DetectionPage;
