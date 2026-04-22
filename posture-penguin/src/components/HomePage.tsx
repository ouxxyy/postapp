import React, { useMemo } from "react";
import { useAppContext } from "../hooks/useAppContext";
import styles from "./HomePage.module.css";
import HistorySection from "./HistorySection";

type PageType = "home" | "detection" | "settings" | "stats" | "poster";

interface HomePageProps {
  onNavigate: (page: PageType) => void;
}

// 医学建议小贴士列表
const POSTURE_TIPS = [
  {
    tip: "坐着时可以适当踮起脚尖，这有助于促进血液循环，还能提醒自己保持正确坐姿哦～",
    source: "美国骨科医师学会",
  },
  {
    tip: "每工作45-60分钟，建议起身活动5-10分钟，可以有效缓解腰椎压力，预防久坐带来的健康问题。",
    source: "世界卫生组织建议",
  },
  {
    tip: "保持屏幕与眼睛的距离在50-70厘米之间，屏幕顶部应与视线平齐或略低，有助于减少颈部压力。",
    source: "美国眼科医学会",
  },
  {
    tip: "正确的坐姿应该是：背部挺直贴靠椅背，双脚平放地面，大腿与地面平行，膝盖弯曲约90度。",
    source: "人体工程学研究",
  },
  {
    tip: "长时间使用电脑时，建议遵循20-20-20法则：每20分钟看20英尺（约6米）远的地方20秒，保护眼睛健康。",
    source: "美国眼科学会",
  },
  {
    tip: "调整椅子高度使手肘呈90度弯曲，键盘和鼠标应在手肘高度附近，可以预防腕管综合征。",
    source: "职业健康研究",
  },
  {
    tip: "肩膀放松下沉，避免耸肩，头部保持正直，耳朵与肩膀在一条垂直线上，这是理想的头颈姿势。",
    source: "物理治疗师建议",
  },
  {
    tip: "使用腰靠垫可以帮助维持腰椎自然弧度，减少腰背疼痛的发生，尤其适合长时间办公的人群。",
    source: "脊柱健康研究",
  },
  {
    tip: "保持规律运动，特别是核心肌群训练，能够有效支撑脊柱，改善姿势，预防腰背疼痛。",
    source: "运动医学研究",
  },
  {
    tip: "避免长时间翘二郎腿，这会导致骨盆倾斜、脊柱侧弯，还可能影响腿部血液循环。",
    source: "骨科医学建议",
  },
];

const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const {
    todayScore,
    todayChecks,
    isDetecting,
    startDetection,
    stopDetection,
  } = useAppContext();

  // 随机选择一条小贴士（每次打开变化）
  const dailyTip = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * POSTURE_TIPS.length);
    return POSTURE_TIPS[randomIndex];
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 90) return "var(--color-success)";
    if (score >= 70) return "var(--color-accent)";
    if (score >= 50) return "var(--color-warning)";
    return "var(--color-danger)";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "优秀";
    if (score >= 70) return "良好";
    if (score >= 50) return "一般";
    return "需改善";
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.penguinIcon}>🐧</span>
          <span className={styles.title}>姿势企鹅</span>
        </div>
        <button
          className={styles.settingsBtn}
          onClick={() => onNavigate("settings")}
          aria-label="设置"
        >
          ⚙️
        </button>
      </div>

      {/* Score Circle */}
      <div className={styles.scoreSection}>
        <div
          className={styles.scoreCircle}
          style={
            {
              "--score-color": getScoreColor(todayScore),
            } as React.CSSProperties
          }
        >
          <div className={styles.scoreValue}>
            {todayChecks > 0 ? todayScore : "--"}
          </div>
          <div className={styles.scoreLabel}>
            {todayChecks > 0 ? getScoreLabel(todayScore) : "暂无数据"}
          </div>
        </div>
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{todayChecks}</span>
            <span className={styles.statLabel}>今日检测</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statValue}>
              {todayChecks > 0
                ? Math.round((todayScore * todayChecks) / 100)
                : 0}
            </span>
            <span className={styles.statLabel}>良好次数</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.actionsSection}>
        <button
          className={`${styles.actionBtn} ${styles.primaryBtn}`}
          onClick={isDetecting ? stopDetection : startDetection}
        >
          <span className={styles.actionIcon}>{isDetecting ? "⏹️" : "📷"}</span>
          <span>{isDetecting ? "停止检测" : "开始检测"}</span>
        </button>
        <div className={styles.actionRow}>
          <button
            className={styles.secondaryBtn}
            onClick={() => onNavigate("detection")}
          >
            <span>🎯</span>
            <span>手动检测</span>
          </button>
          <button
            className={styles.secondaryBtn}
            onClick={() => onNavigate("stats")}
          >
            <span>📊</span>
            <span>数据统计</span>
          </button>
        </div>
        <button
          className={styles.shareBtn}
          onClick={() => onNavigate("poster")}
        >
          <span>🖼️</span>
          <span>分享海报</span>
        </button>
      </div>

      {/* Recent Detection History */}
      <HistorySection />

      {/* Daily Tip */}
      <div className={styles.tipSection}>
        <div className={styles.tipHeader}>
          <span className={styles.tipIcon}>💡</span>
          <span className={styles.tipTitle}>今日小贴士</span>
        </div>
        <p className={styles.tipContent}>{dailyTip.tip}</p>
        <span className={styles.tipSource}>— {dailyTip.source}</span>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span className={styles.footerText}>隐私保护：所有数据本地处理 🛡️</span>
      </div>
    </div>
  );
};

export default HomePage;
