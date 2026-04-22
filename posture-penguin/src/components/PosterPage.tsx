import React, { useRef, useEffect, useState, useCallback } from "react";
import { useAppContext } from "../hooks/useAppContext";
import styles from "./PosterPage.module.css";

interface PosterPageProps {
  onBack: () => void;
}

const PosterPage: React.FC<PosterPageProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const { todayScore, todayChecks, getWeeklyStats } = useAppContext();
  const [weeklyAvgScore, setWeeklyAvgScore] = useState<number | null>(null);

  const renderPoster = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const posterImg = new Image();
    posterImg.crossOrigin = "anonymous";
    posterImg.onload = () => {
      const { naturalWidth: pw, naturalHeight: ph } = posterImg;
      canvas.width = pw;
      canvas.height = ph;
      ctx.drawImage(posterImg, 0, 0, pw, ph);

      // Draw score overlay if user has data
      if (todayChecks > 0) {
        const scoreText = `${todayScore}`;
        const labelText = "今日姿势评分";

        // Position: middle area, well above QR zone
        const scoreY = Math.round(ph * 0.6);
        const scoreX = Math.round(pw * 0.5);

        // Semi-transparent background pill
        const pillW = Math.round(pw * 0.42);
        const pillH = Math.round(ph * 0.085);
        const pillX = scoreX - pillW / 2;
        const pillY = scoreY - pillH / 2;
        const pillR = Math.round(pillH * 0.4);

        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.moveTo(pillX + pillR, pillY);
        ctx.lineTo(pillX + pillW - pillR, pillY);
        ctx.quadraticCurveTo(
          pillX + pillW,
          pillY,
          pillX + pillW,
          pillY + pillR,
        );
        ctx.lineTo(pillX + pillW, pillY + pillH - pillR);
        ctx.quadraticCurveTo(
          pillX + pillW,
          pillY + pillH,
          pillX + pillW - pillR,
          pillY + pillH,
        );
        ctx.lineTo(pillX + pillR, pillY + pillH);
        ctx.quadraticCurveTo(
          pillX,
          pillY + pillH,
          pillX,
          pillY + pillH - pillR,
        );
        ctx.lineTo(pillX, pillY + pillR);
        ctx.quadraticCurveTo(pillX, pillY, pillX + pillR, pillY);
        ctx.closePath();
        ctx.fill();

        // Label text
        ctx.fillStyle = "#5b7a8a";
        ctx.font = `bold ${Math.round(pw * 0.032)}px "Noto Sans SC", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(labelText, scoreX, scoreY - pillH * 0.2);

        // Score number
        ctx.fillStyle = todayScore >= 70 ? "#4CAF50" : "#ff8a9b";
        ctx.font = `900 ${Math.round(pw * 0.09)}px "Noto Sans SC", sans-serif`;
        ctx.fillText(scoreText, scoreX, scoreY + pillH * 0.22);

        ctx.restore();

        // Draw weekly average score below daily score
        if (weeklyAvgScore !== null && weeklyAvgScore > 0) {
          const weeklyLabelText = "本周平均";
          const weeklyScoreText = `${weeklyAvgScore}`;
          const weeklyY = scoreY + pillH + ph * 0.02;

          // Weekly pill (smaller)
          const weeklyPillW = Math.round(pw * 0.32);
          const weeklyPillH = Math.round(ph * 0.055);
          const weeklyPillX = scoreX - weeklyPillW / 2;
          const weeklyPillY = weeklyY - weeklyPillH / 2;
          const weeklyPillR = Math.round(weeklyPillH * 0.4);

          ctx.save();
          ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
          ctx.beginPath();
          ctx.moveTo(weeklyPillX + weeklyPillR, weeklyPillY);
          ctx.lineTo(weeklyPillX + weeklyPillW - weeklyPillR, weeklyPillY);
          ctx.quadraticCurveTo(
            weeklyPillX + weeklyPillW,
            weeklyPillY,
            weeklyPillX + weeklyPillW,
            weeklyPillY + weeklyPillR,
          );
          ctx.lineTo(
            weeklyPillX + weeklyPillW,
            weeklyPillY + weeklyPillH - weeklyPillR,
          );
          ctx.quadraticCurveTo(
            weeklyPillX + weeklyPillW,
            weeklyPillY + weeklyPillH,
            weeklyPillX + weeklyPillW - weeklyPillR,
            weeklyPillY + weeklyPillH,
          );
          ctx.lineTo(weeklyPillX + weeklyPillR, weeklyPillY + weeklyPillH);
          ctx.quadraticCurveTo(
            weeklyPillX,
            weeklyPillY + weeklyPillH,
            weeklyPillX,
            weeklyPillY + weeklyPillH - weeklyPillR,
          );
          ctx.lineTo(weeklyPillX, weeklyPillY + weeklyPillR);
          ctx.quadraticCurveTo(
            weeklyPillX,
            weeklyPillY,
            weeklyPillX + weeklyPillR,
            weeklyPillY,
          );
          ctx.closePath();
          ctx.fill();

          // Weekly label
          ctx.fillStyle = "#8ba3b3";
          ctx.font = `bold ${Math.round(pw * 0.022)}px "Noto Sans SC", sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(weeklyLabelText, scoreX, weeklyY - weeklyPillH * 0.15);

          // Weekly score
          ctx.fillStyle = weeklyAvgScore >= 70 ? "#4CAF50" : "#ff8a9b";
          ctx.font = `700 ${Math.round(pw * 0.055)}px "Noto Sans SC", sans-serif`;
          ctx.fillText(weeklyScoreText, scoreX, weeklyY + weeklyPillH * 0.35);

          ctx.restore();
        }
      }

      // Draw QR code
      const qrImg = new Image();
      qrImg.crossOrigin = "anonymous";
      qrImg.onload = () => {
        // Smaller QR: ~20% of poster width to avoid overlap with text
        const qrSize = Math.round(pw * 0.2);
        const qrX = Math.round((pw - qrSize) / 2);
        const qrY = Math.round(ph - qrSize - ph * 0.03);

        // White rounded background for QR
        const pad = Math.round(qrSize * 0.1);
        const r = Math.round(qrSize * 0.06);
        const bx = qrX - pad;
        const by = qrY - pad;
        const bw = qrSize + pad * 2;
        const bh = qrSize + pad * 2;

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + bw - r, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
        ctx.lineTo(bx + bw, by + bh - r);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
        ctx.lineTo(bx + r, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
        ctx.lineTo(bx, by + r);
        ctx.quadraticCurveTo(bx, by, bx + r, by);
        ctx.closePath();
        ctx.fill();

        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

        // "扫码下载" hint text below QR
        ctx.fillStyle = "#8ba3b3";
        ctx.font = `bold ${Math.round(pw * 0.028)}px "Noto Sans SC", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("扫码下载姿势企鹅 🐧", pw / 2, qrY + qrSize + pad * 0.5);

        setRendering(false);
      };
      qrImg.onerror = () => {
        setRendering(false);
      };
      qrImg.src = chrome.runtime.getURL("qrcode.jpg");
    };
    posterImg.onerror = () => {
      setRendering(false);
    };
    posterImg.src = chrome.runtime.getURL("poster.png");
  }, [todayScore, todayChecks, weeklyAvgScore]);

  // Load weekly average score
  useEffect(() => {
    const loadWeeklyStats = async () => {
      try {
        const weeklyStats = await getWeeklyStats();
        // Calculate weekly average from all valid days
        const validDays = weeklyStats.filter((day) => day.totalChecks > 0);
        if (validDays.length > 0) {
          const totalScore = validDays.reduce(
            (sum, day) => sum + day.avgScore * day.totalChecks,
            0,
          );
          const totalChecks = validDays.reduce(
            (sum, day) => sum + day.totalChecks,
            0,
          );
          setWeeklyAvgScore(Math.round(totalScore / totalChecks));
        }
      } catch (error) {
        console.error("Failed to load weekly stats:", error);
      }
    };
    loadWeeklyStats();
  }, [getWeeklyStats]);

  useEffect(() => {
    renderPoster();
  }, [renderPoster]);

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setDownloading(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `姿势企鹅_海报_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          ← 返回
        </button>
        <span className={styles.title}>分享海报</span>
        <div className={styles.spacer} />
      </div>

      <div className={styles.previewArea}>
        {rendering && <div className={styles.loading}>海报生成中...</div>}
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          style={{ display: rendering ? "none" : "block" }}
        />
      </div>

      <div className={styles.actions}>
        <button
          className={styles.downloadBtn}
          onClick={handleDownload}
          disabled={rendering || downloading}
        >
          {downloading ? "保存中..." : "💾 保存海报"}
        </button>
      </div>

      <p className={styles.hint}>保存海报后分享给朋友，一起坐得更健康 🐧</p>
    </div>
  );
};

export default PosterPage;
