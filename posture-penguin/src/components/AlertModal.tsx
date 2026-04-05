import React, { useEffect, useState } from "react";
import styles from "./AlertModal.module.css";

interface AlertModalProps {
  message: string;
  score: number;
  issues: string[];
  onClose: () => void;
}

const AlertModal: React.FC<AlertModalProps> = ({
  message,
  score,
  issues,
  onClose,
}) => {
  const [progress, setProgress] = useState(100);

  // 5秒自动关闭
  useEffect(() => {
    const duration = 5000;
    const interval = 50;
    const steps = duration / interval;
    let currentStep = steps;

    const timer = setInterval(() => {
      currentStep--;
      setProgress((currentStep / steps) * 100);

      if (currentStep <= 0) {
        clearInterval(timer);
        onClose();
      }
    }, interval);

    return () => clearInterval(timer);
  }, [onClose]);

  const getIssueIcon = (issue: string) => {
    switch (issue) {
      case "headForward":
        return "🔺";
      case "hunchback":
        return "🔶";
      case "misaligned":
        return "↔️";
      default:
        return "⚠️";
    }
  };

  const getIssueText = (issue: string) => {
    switch (issue) {
      case "headForward":
        return "头部前倾";
      case "hunchback":
        return "含胸驼背";
      case "misaligned":
        return "坐姿偏歪/双肩不平衡";
      default:
        return "姿势问题";
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Penguin Animation */}
        <div className={styles.penguinWrapper}>
          <div className={styles.penguin}>🐧</div>
          <div className={styles.wave}>👋</div>
        </div>

        {/* Message */}
        <div className={styles.content}>
          <p className={styles.message}>{message}</p>

          {issues.length > 0 && (
            <div className={styles.issues}>
              {issues.map((issue, idx) => (
                <span key={idx} className={styles.issueBadge}>
                  {getIssueIcon(issue)} {getIssueText(issue)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Score */}
        <div className={styles.scoreSection}>
          <span
            className={styles.scoreValue}
            style={{
              color:
                score >= 70 ? "var(--color-warning)" : "var(--color-danger)",
            }}
          >
            {score}分
          </span>
        </div>

        {/* Stretch Suggestion */}
        <div className={styles.suggestion}>
          <span className={styles.suggestionIcon}>💪</span>
          <span className={styles.suggestionText}>
            试试收下巴、肩膀向后打开，或者站起来活动一下
          </span>
        </div>

        {/* Action Button */}
        <button className={styles.actionBtn} onClick={onClose}>
          我知道了
        </button>

        {/* Progress Bar */}
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
