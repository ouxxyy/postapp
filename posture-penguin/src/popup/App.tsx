import React, { useState, useEffect } from "react";
import HomePage from "../components/HomePage";
import DetectionPage from "../components/DetectionPage";
import SettingsPage from "../components/SettingsPage";
import StatsPage from "../components/StatsPage";
import AlertModal from "../components/AlertModal";
import PermissionPage from "../components/PermissionPage";
import { AppProvider, useAppContext } from "../hooks/useAppContext";
import { preloadSharedPostureDetector } from "../lib/sharedPostureDetector";

type PageType = "home" | "detection" | "settings" | "stats" | "permission";

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>(() => {
    const isRequestingCamera =
      new URLSearchParams(window.location.search).get("requestCamera") ===
      "true";
    return isRequestingCamera ? "permission" : "home";
  });
  const { alertState, dismissAlert } = useAppContext();

  useEffect(() => {
    preloadSharedPostureDetector().catch((error) => {
      console.warn("[App] 检测模型预加载失败:", error);
    });
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return <HomePage onNavigate={setCurrentPage} />;
      case "detection":
        return <DetectionPage onBack={() => setCurrentPage("home")} />;
      case "settings":
        return <SettingsPage onBack={() => setCurrentPage("home")} />;
      case "stats":
        return <StatsPage onBack={() => setCurrentPage("home")} />;
      case "permission":
        return <PermissionPage />;
      default:
        return <HomePage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="app">
      {renderPage()}
      {alertState.visible && (
        <AlertModal
          message={alertState.message}
          score={alertState.score}
          issues={alertState.issues}
          onClose={dismissAlert}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
