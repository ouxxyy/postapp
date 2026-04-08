import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { getLocalDateKey } from "../lib/dateKey";

// 类型定义
export interface PostureRecord {
  id: string;
  timestamp: number;
  score: number;
  issues: string[];
  headForward: boolean;
  hunchback: boolean;
  misaligned: boolean;
}

export interface DailyStats {
  date: string;
  avgScore: number;
  totalChecks: number;
  goodPostureCount: number;
  warningCount: number;
}

export interface Settings {
  checkInterval: number; // 分钟
  soundEnabled: boolean;
  soundVolume: number;
  dailyStartTime: string;
  dailyEndTime: string;
  isPremium: boolean;
}

export interface AlertState {
  visible: boolean;
  message: string;
  score: number;
  issues: string[];
}

const DETECTION_ENABLED_KEY = "detectionEnabled";

function isValidPostureRecord(record: {
  score: number;
  issues: string[];
}): boolean {
  if (record.score <= 0) return false;
  if (record.issues.includes("noPoseDetected")) return false;
  if (record.issues.includes("lowConfidence")) return false;
  return true;
}

interface AppContextType {
  // 状态
  todayScore: number;
  todayChecks: number;
  settings: Settings;
  alertState: AlertState;
  postureHistory: PostureRecord[];
  isDetecting: boolean;
  recentRecords: PostureRecord[]; // 最近 5 条检测记录

  // 方法
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  addPostureRecord: (
    record: Omit<PostureRecord, "id" | "timestamp">,
  ) => Promise<void>;
  showAlert: (message: string, score: number, issues: string[]) => void;
  dismissAlert: () => void;
  startDetection: () => Promise<void>;
  stopDetection: () => Promise<void>;
  getTodayStats: () => Promise<DailyStats>;
  getWeeklyStats: () => Promise<DailyStats[]>;
  getRecentRecords: () => Promise<PostureRecord[]>; // 获取最近 5 条记录
}

const defaultSettings: Settings = {
  checkInterval: 20,
  soundEnabled: true,
  soundVolume: 0.5,
  dailyStartTime: "09:00",
  dailyEndTime: "18:00",
  isPremium: false,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [todayScore, setTodayScore] = useState(0);
  const [todayChecks, setTodayChecks] = useState(0);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    message: "",
    score: 0,
    issues: [],
  });
  const [postureHistory, setPostureHistory] = useState<PostureRecord[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [recentRecords, setRecentRecords] = useState<PostureRecord[]>([]);

  const loadTodayStats = useCallback(async () => {
    try {
      const today = getLocalDateKey();
      const result = await chrome.storage.local.get(`records_${today}`);
      const allRecords: PostureRecord[] = result[`records_${today}`] || [];
      const records = allRecords.filter(isValidPostureRecord);

      setPostureHistory(records);
      setTodayChecks(records.length);

      if (records.length > 0) {
        const avgScore = Math.round(
          records.reduce((sum, r) => sum + r.score, 0) / records.length,
        );
        setTodayScore(avgScore);
      } else {
        setTodayScore(0);
      }
    } catch (error) {
      console.error("Failed to load today stats:", error);
    }
  }, []);

  // 初始化加载设置和检测状态
  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const result = await chrome.storage.local.get([
          "settings",
          DETECTION_ENABLED_KEY,
        ]);
        if (result.settings) {
          setSettings(result.settings);
        }

        setIsDetecting(Boolean(result[DETECTION_ENABLED_KEY]));
      } catch (error) {
        console.error("Failed to load initial state:", error);
      }
    };
    loadInitialState();
  }, []);

  // 加载今日统计
  useEffect(() => {
    loadTodayStats();
  }, [loadTodayStats]);

  // 接收后台检测状态变更 / 新记录事件
  useEffect(() => {
    const listener = (message: { type?: string; enabled?: boolean }) => {
      if (message.type === "DETECTION_STATE_CHANGED") {
        setIsDetecting(Boolean(message.enabled));
      }

      if (message.type === "POSTURE_RECORDED") {
        void loadTodayStats();
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [loadTodayStats]);

  const updateSettings = useCallback(
    async (newSettings: Partial<Settings>) => {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      await chrome.storage.local.set({ settings: updated });

      if (
        isDetecting &&
        typeof newSettings.checkInterval === "number" &&
        newSettings.checkInterval !== settings.checkInterval
      ) {
        await chrome.runtime.sendMessage({
          type: "UPDATE_INTERVAL",
          interval: newSettings.checkInterval,
        });
      }
    },
    [settings, isDetecting],
  );

  const addPostureRecord = useCallback(
    async (record: Omit<PostureRecord, "id" | "timestamp">) => {
      if (!isValidPostureRecord(record)) {
        return;
      }

      const newRecord: PostureRecord = {
        ...record,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };

      const today = getLocalDateKey();
      const key = `records_${today}`;

      const result = await chrome.storage.local.get(key);
      const existingRecords: PostureRecord[] = result[key] || [];
      const updatedRecords = [...existingRecords, newRecord];

      await chrome.storage.local.set({ [key]: updatedRecords });

      setPostureHistory(updatedRecords);
      setTodayChecks(updatedRecords.length);

      const avgScore = Math.round(
        updatedRecords.reduce((sum, r) => sum + r.score, 0) /
          updatedRecords.length,
      );
      setTodayScore(avgScore);
    },
    [],
  );

  const showAlert = useCallback(
    (message: string, score: number, issues: string[]) => {
      setAlertState({
        visible: true,
        message,
        score,
        issues,
      });
    },
    [],
  );

  const dismissAlert = useCallback(() => {
    setAlertState({
      visible: false,
      message: "",
      score: 0,
      issues: [],
    });
  }, []);

  const startDetection = useCallback(async () => {
    try {
      // 首次使用：检查摄像头权限，未授权则跳转到 DetectionPage 走完整授权流程
      let permState: PermissionState = "granted";
      try {
        const perm = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        permState = perm.state;
      } catch {
        // permissions API 不支持时默认尝试启动（getUserMedia 会在后续步骤中处理）
      }

      if (permState === "denied") {
        // 权限已拒绝：打开 DetectionPage 显示手动授权提示
        chrome.tabs.create({
          url: chrome.runtime.getURL("popup.html?page=detection"),
        });
        return;
      }

      if (permState === "prompt") {
        // 权限未决定：打开 DetectionPage，由其引导用户完成授权
        chrome.tabs.create({
          url: chrome.runtime.getURL("popup.html?page=detection"),
        });
        return;
      }

      // 权限已授权：正常启动定时检测
      const response = await chrome.runtime.sendMessage({
        type: "START_DETECTION",
      });

      if (response?.success) {
        setIsDetecting(true);
        await chrome.storage.local.set({ [DETECTION_ENABLED_KEY]: true });
      } else {
        setIsDetecting(false);
      }
    } catch (error) {
      console.error("Failed to start detection:", error);
      setIsDetecting(false);
    }
  }, []);

  const stopDetection = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "STOP_DETECTION",
      });

      if (response?.success) {
        setIsDetecting(false);
        await chrome.storage.local.set({ [DETECTION_ENABLED_KEY]: false });
      }
    } catch (error) {
      console.error("Failed to stop detection:", error);
    }
  }, []);

  const getTodayStats = useCallback(async (): Promise<DailyStats> => {
    const today = getLocalDateKey();
    const result = await chrome.storage.local.get(`records_${today}`);
    const allRecords: PostureRecord[] = result[`records_${today}`] || [];
    const records = allRecords.filter(isValidPostureRecord);

    return {
      date: today,
      avgScore:
        records.length > 0
          ? Math.round(
              records.reduce((sum, r) => sum + r.score, 0) / records.length,
            )
          : 0,
      totalChecks: records.length,
      goodPostureCount: records.filter((r) => r.score >= 70).length,
      warningCount: records.filter((r) => r.score < 70).length,
    };
  }, []);

  const getWeeklyStats = useCallback(async (): Promise<DailyStats[]> => {
    const stats: DailyStats[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = getLocalDateKey(date);
      const result = await chrome.storage.local.get(`records_${dateStr}`);
      const allRecords: PostureRecord[] = result[`records_${dateStr}`] || [];
      const records = allRecords.filter(isValidPostureRecord);

      stats.push({
        date: dateStr,
        avgScore:
          records.length > 0
            ? Math.round(
                records.reduce((sum, r) => sum + r.score, 0) / records.length,
              )
            : 0,
        totalChecks: records.length,
        goodPostureCount: records.filter((r) => r.score >= 70).length,
        warningCount: records.filter((r) => r.score < 70).length,
      });
    }

    return stats;
  }, []);

  // 获取最近 5 条检测记录（跨多日）
  const getRecentRecords = useCallback(async (): Promise<PostureRecord[]> => {
    const allRecords: PostureRecord[] = [];
    const today = new Date();

    // 从今天往前查 7 天，收集所有有效记录
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = getLocalDateKey(date);
      const result = await chrome.storage.local.get(`records_${dateStr}`);
      const records: PostureRecord[] = result[`records_${dateStr}`] || [];
      allRecords.push(...records.filter(isValidPostureRecord));
    }

    // 按时间戳降序排序，取最近 5 条
    const sortedRecords = allRecords
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);

    return sortedRecords;
  }, []);

  // 加载最近记录
  const loadRecentRecords = useCallback(async () => {
    const records = await getRecentRecords();
    setRecentRecords(records);
  }, [getRecentRecords]);

  // 初始化加载最近记录
  useEffect(() => {
    loadRecentRecords();
  }, [loadRecentRecords]);

  // 监听新记录事件，刷新最近记录
  useEffect(() => {
    const listener = (message: { type?: string }) => {
      if (message.type === "POSTURE_RECORDED") {
        void loadRecentRecords();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [loadRecentRecords]);

  const value: AppContextType = {
    todayScore,
    todayChecks,
    settings,
    alertState,
    postureHistory,
    isDetecting,
    recentRecords,
    updateSettings,
    addPostureRecord,
    showAlert,
    dismissAlert,
    startDetection,
    stopDetection,
    getTodayStats,
    getWeeklyStats,
    getRecentRecords,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};
