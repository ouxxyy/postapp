import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

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

interface AppContextType {
  // 状态
  todayScore: number;
  todayChecks: number;
  settings: Settings;
  alertState: AlertState;
  postureHistory: PostureRecord[];
  isDetecting: boolean;

  // 方法
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  addPostureRecord: (
    record: Omit<PostureRecord, "id" | "timestamp">,
  ) => Promise<void>;
  showAlert: (message: string, score: number, issues: string[]) => void;
  dismissAlert: () => void;
  startDetection: () => void;
  stopDetection: () => void;
  getTodayStats: () => Promise<DailyStats>;
  getWeeklyStats: () => Promise<DailyStats[]>;
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

  // 初始化加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await chrome.storage.local.get("settings");
        if (result.settings) {
          setSettings(result.settings);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSettings();
  }, []);

  // 加载今日统计
  useEffect(() => {
    const loadTodayStats = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const result = await chrome.storage.local.get(`records_${today}`);
        if (result[`records_${today}`]) {
          const records: PostureRecord[] = result[`records_${today}`];
          setPostureHistory(records);
          setTodayChecks(records.length);
          if (records.length > 0) {
            const avgScore = Math.round(
              records.reduce((sum, r) => sum + r.score, 0) / records.length,
            );
            setTodayScore(avgScore);
          }
        }
      } catch (error) {
        console.error("Failed to load today stats:", error);
      }
    };
    loadTodayStats();
  }, []);

  const updateSettings = useCallback(
    async (newSettings: Partial<Settings>) => {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      await chrome.storage.local.set({ settings: updated });
    },
    [settings],
  );

  const addPostureRecord = useCallback(
    async (record: Omit<PostureRecord, "id" | "timestamp">) => {
      const newRecord: PostureRecord = {
        ...record,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };

      const today = new Date().toISOString().split("T")[0];
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
    /**
     * 「开始检测」= 启用定时提醒模式
     * 不在此处打开摄像头，因为：
     * 1. popup 关闭后摄像头流无法持续
     * 2. offscreen 的 getUserMedia 在 MV3 中有 CSP 限制
     * 真正的摄像头使用只在 DetectionPage 的手动检测中按需触发
     */
    setIsDetecting(true);
    // 通知 service-worker 创建定时提醒闹钟
    chrome.runtime.sendMessage({ type: "START_DETECTION" });
  }, []);


  const stopDetection = useCallback(() => {
    setIsDetecting(false);
    // 通知 service-worker 取消定时提醒
    chrome.runtime.sendMessage({ type: "STOP_DETECTION" });
  }, []);

  const getTodayStats = useCallback(async (): Promise<DailyStats> => {
    const today = new Date().toISOString().split("T")[0];
    const result = await chrome.storage.local.get(`records_${today}`);
    const records: PostureRecord[] = result[`records_${today}`] || [];

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
      const dateStr = date.toISOString().split("T")[0];
      const result = await chrome.storage.local.get(`records_${dateStr}`);
      const records: PostureRecord[] = result[`records_${dateStr}`] || [];

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

  const value: AppContextType = {
    todayScore,
    todayChecks,
    settings,
    alertState,
    postureHistory,
    isDetecting,
    updateSettings,
    addPostureRecord,
    showAlert,
    dismissAlert,
    startDetection,
    stopDetection,
    getTodayStats,
    getWeeklyStats,
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
