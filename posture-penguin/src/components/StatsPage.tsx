import React, { useState, useEffect } from "react";
import { useAppContext } from "../hooks/useAppContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import styles from "./StatsPage.module.css";

interface StatsPageProps {
  onBack: () => void;
}

const StatsPage: React.FC<StatsPageProps> = ({ onBack }) => {
  const { getWeeklyStats, settings } = useAppContext();
  const [weeklyData, setWeeklyData] = useState<
    Array<{
      date: string;
      avgScore: number;
      totalChecks: number;
    }>
  >([]);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const stats = await getWeeklyStats();
      setWeeklyData(
        stats.map((s) => ({
          date: formatDate(s.date),
          avgScore: s.avgScore,
          totalChecks: s.totalChecks,
        })),
      );
      setLoading(false);
    };
    loadData();
  }, [getWeeklyStats]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    return `周${weekdays[date.getDay()]}`;
  };

  const avgScore =
    weeklyData.length > 0
      ? Math.round(
          weeklyData.reduce((sum, d) => sum + d.avgScore, 0) /
            weeklyData.length,
        )
      : 0;

  const totalChecks = weeklyData.reduce((sum, d) => sum + d.totalChecks, 0);

  const goodDays = weeklyData.filter((d) => d.avgScore >= 70).length;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          ← 返回
        </button>
        <span className={styles.title}>数据统计</span>
        <div style={{ width: 60 }} />
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{avgScore}</div>
          <div className={styles.summaryLabel}>本周平均分</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{totalChecks}</div>
          <div className={styles.summaryLabel}>本周检测次数</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{goodDays}</div>
          <div className={styles.summaryLabel}>良好天数</div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className={styles.viewToggle}>
        <button
          className={`${styles.toggleBtn} ${viewMode === "week" ? styles.active : ""}`}
          onClick={() => setViewMode("week")}
        >
          周视图
        </button>
        <button
          className={`${styles.toggleBtn} ${viewMode === "month" ? styles.active : ""}`}
          onClick={() => setViewMode("month")}
        >
          月视图
        </button>
        {!settings.isPremium && viewMode === "month" && (
          <span className={styles.premiumBadge}>👑 会员</span>
        )}
      </div>

      {/* Chart */}
      <div className={styles.chartSection}>
        <h3 className={styles.chartTitle}>姿势评分趋势</h3>
        {loading ? (
          <div className={styles.loading}>加载中...</div>
        ) : weeklyData.length > 0 ? (
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weeklyData}>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#8ba3b3" }}
                />
                <YAxis
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#8ba3b3" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 2px 12px rgba(91, 122, 138, 0.15)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  stroke="#ff8a9b"
                  strokeWidth={3}
                  dot={{ fill: "#ff8a9b", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#ff8a9b" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.noData}>暂无数据，开始检测吧！</div>
        )}
      </div>

      {/* Premium Upsell */}
      {!settings.isPremium && (
        <div className={styles.premiumSection}>
          <div className={styles.premiumCard}>
            <div className={styles.premiumHeader}>
              <span className={styles.premiumIcon}>📊</span>
              <span className={styles.premiumTitle}>解锁完整统计</span>
            </div>
            <p className={styles.premiumDesc}>
              开通会员，解锁月视图、周月报告导出、姿势改善分析等高级功能
            </p>
            <button className={styles.premiumBtn}>立即开通</button>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className={styles.tipsSection}>
        <h3 className={styles.tipsTitle}>改善建议</h3>
        <ul className={styles.tipsList}>
          <li className={styles.tipItem}>
            <span className={styles.tipIcon}>🪑</span>
            <div className={styles.tipContent}>
              <strong>调整座椅高度</strong>
              <p>让双脚能平放在地面，大腿与地面平行</p>
            </div>
          </li>
          <li className={styles.tipItem}>
            <span className={styles.tipIcon}>📱</span>
            <div className={styles.tipContent}>
              <strong>屏幕位置</strong>
              <p>显示器顶部与眼睛平齐，距离约一臂距离</p>
            </div>
          </li>
          <li className={styles.tipItem}>
            <span className={styles.tipIcon}>⏰</span>
            <div className={styles.tipContent}>
              <strong>定时休息</strong>
              <p>每45分钟起身活动5分钟，做一些简单的拉伸</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default StatsPage;
