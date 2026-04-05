import React, { useState, useEffect } from "react";
import { useAppContext } from "../hooks/useAppContext";
import styles from "./SettingsPage.module.css";

interface SettingsPageProps {
  onBack: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  const { settings, updateSettings } = useAppContext();

  const [localSettings, setLocalSettings] = useState(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    await updateSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const intervalOptions = [10, 15, 20, 30, 45, 60];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          ← 返回
        </button>
        <span className={styles.title}>设置</span>
        <div style={{ width: 60 }} />
      </div>

      {/* Detection Settings */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>检测设置</h3>

        <div className={styles.settingItem}>
          <div className={styles.settingLabel}>
            <span className={styles.settingName}>检测间隔</span>
            <span className={styles.settingDesc}>每隔多久自动检测一次姿势</span>
          </div>
          <div className={styles.intervalBtns}>
            {intervalOptions.map((min) => (
              <button
                key={min}
                className={`${styles.intervalBtn} ${
                  localSettings.checkInterval === min ? styles.active : ""
                }`}
                onClick={() =>
                  setLocalSettings({ ...localSettings, checkInterval: min })
                }
              >
                {min}分
              </button>
            ))}
          </div>
        </div>

        <div className={styles.settingItem}>
          <div className={styles.settingLabel}>
            <span className={styles.settingName}>提醒时段</span>
            <span className={styles.settingDesc}>
              仅在此时间段内进行检测提醒
            </span>
          </div>
          <div className={styles.timeRange}>
            <input
              type="time"
              value={localSettings.dailyStartTime}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  dailyStartTime: e.target.value,
                })
              }
              className={styles.timeInput}
            />
            <span className={styles.timeSeparator}>至</span>
            <input
              type="time"
              value={localSettings.dailyEndTime}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  dailyEndTime: e.target.value,
                })
              }
              className={styles.timeInput}
            />
          </div>
        </div>
      </section>

      {/* Notification Settings */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>通知设置</h3>

        <div className={styles.settingItem}>
          <div className={styles.settingLabel}>
            <span className={styles.settingName}>提醒音效</span>
            <span className={styles.settingDesc}>
              姿势问题检测到时播放提示音
            </span>
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={localSettings.soundEnabled}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  soundEnabled: e.target.checked,
                })
              }
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>

        {localSettings.soundEnabled && (
          <div className={styles.settingItem}>
            <div className={styles.settingLabel}>
              <span className={styles.settingName}>音量</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={localSettings.soundVolume * 100}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  soundVolume: parseInt(e.target.value) / 100,
                })
              }
              className={styles.volumeSlider}
            />
          </div>
        )}
      </section>

      {/* Privacy Notice */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>隐私保护</h3>
        <div className={styles.privacyCard}>
          <div className={styles.privacyIcon}>🔒</div>
          <h4 className={styles.privacyTitle}>数据本地处理</h4>
          <p className={styles.privacyDesc}>
            所有姿势检测和图像处理均在您的设备本地完成，不会上传到任何服务器。
            您的数据完全由您自己掌控。
          </p>
        </div>
      </section>

      {/* Premium Section */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>会员功能</h3>
        <div className={styles.premiumCard}>
          <div className={styles.premiumHeader}>
            <span className={styles.premiumIcon}>👑</span>
            <span className={styles.premiumTitle}>解锁高级功能</span>
          </div>
          <ul className={styles.premiumFeatures}>
            <li>📊 姿势改善趋势图</li>
            <li>📅 周月报详细分析</li>
            <li>🎵 自定义提醒音效</li>
            <li>☁️ 多设备数据同步</li>
          </ul>
          <button className={styles.premiumBtn}>¥18/月 开通会员</button>
        </div>
      </section>

      {/* Save Button */}
      <div className={styles.footer}>
        <button className={styles.saveBtn} onClick={handleSave}>
          {saved ? "✓ 已保存" : "保存设置"}
        </button>
      </div>

      {/* Version */}
      <div className={styles.version}>姿势企鹅 v1.0.0</div>
    </div>
  );
};

export default SettingsPage;
