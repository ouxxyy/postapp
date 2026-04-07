import React from "react";
import { useAppContext, PostureRecord } from "../hooks/useAppContext";
import styles from "./HistorySection.module.css";

const HistorySection: React.FC = () => {
  const { recentRecords } = useAppContext();

  // 格式化时间为相对时间
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    return `${days}天前`;
  };

  // 获取分数对应的颜色
  const getScoreColor = (score: number) => {
    if (score >= 90) return "var(--color-success)";
    if (score >= 70) return "var(--color-primary)";
    if (score >= 50) return "var(--color-warning)";
    return "var(--color-danger)";
  };

  // 获取分数对应的标签
  const getScoreLabel = (score: number) => {
    if (score >= 90) return "优秀";
    if (score >= 70) return "良好";
    if (score >= 50) return "一般";
    return "需改善";
  };

  // 生成建议
  const getAdvice = (record: PostureRecord) => {
    if (record.headForward) return "注意头部前倾";
    if (record.hunchback) return "注意驼背";
    if (record.misaligned) return "注意坐姿不正";
    return "姿势良好";
  };

  if (recentRecords.length === 0) {
    return null;
  }

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className={styles.icon}>📝</span>
        <span className={styles.title}>最近检测</span>
      </div>
      <div className={styles.list}>
        {recentRecords.map((record) => (
          <div key={record.id} className={styles.item}>
            <div className={styles.time}>{formatTime(record.timestamp)}</div>
            <div
              className={styles.score}
              style={{ color: getScoreColor(record.score) }}
            >
              {record.score}
            </div>
            <div className={styles.label}>{getScoreLabel(record.score)}</div>
            <div className={styles.advice}>{getAdvice(record)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistorySection;
