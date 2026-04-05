import React, { useState, useEffect } from "react";
import styles from "./PermissionPage.module.css";

const PermissionPage: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 此页面作为独立全屏 Tab 打开（popup.html?requestCamera=true）
  // 需要覆盖 global.css 里为弹窗设置的固定 360px 宽度
  useEffect(() => {
    const root = document.getElementById("root");
    if (root) {
      root.style.width = "100vw";
      root.style.maxHeight = "none";
      root.style.height = "100vh";
      root.style.overflowY = "auto";
    }
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.minHeight = "100vh";
    return () => {
      if (root) {
        root.style.width = "";
        root.style.maxHeight = "";
        root.style.height = "";
        root.style.overflowY = "";
      }
    };
  }, []);


  const requestPermission = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // 成功获取权限后立即释放，防止占用
      stream.getTracks().forEach((track) => track.stop());
      setIsSuccess(true);
      
      // 2秒后自动关闭标签页
      setTimeout(() => {
        window.close();
      }, 2000);
    } catch (err) {
      console.error("Failed to request permission:", err);
      // 有可能是用户阻止，也有可能是设备问题
      if (err instanceof DOMException && err.name === "NotAllowedError") {
          setError("刚才权限被拒绝了，请在地址栏左侧的权限设置中允许“姿势企鹅”使用您的摄像头。");
      } else {
          setError("找不到摄像头设备或出现意外错误：" + (err as Error).message);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.icon}>📷</div>
      <h1 className={styles.title}>需要您的授权</h1>
      <p className={styles.description}>
        由于 Chrome 的安全限制，我们需要在独立页面上向您申请一次摄像头权限。
        <br/><br/>
        姿势企鹅承诺所有的图像处理都<b>只会在本地离线完成，绝不会上传。</b>
      </p>

      {!isSuccess ? (
        <button 
          className={`${styles.button} ${isProcessing ? styles.buttonDisabled : ''}`} 
          onClick={requestPermission}
          disabled={isProcessing}
        >
          {isProcessing ? "⏳ 处理中..." : "✅ 点击授权使用摄像头"}
        </button>
      ) : (
        <div className={styles.successMessage}>
          <span className={styles.successIcon}>🎉</span>
          <span className={styles.successText}>摄像头授权成功！</span>
          <span className={styles.successHint}>该页面将在 2 秒后自动关闭。<br/>关闭后请点击浏览器工具栏的🐧图标，再次点击「手动检测」即可开始检测。</span>
        </div>

      )}

      {error && <div className={styles.errorText}>⚠️ {error}</div>}
    </div>
  );
};

export default PermissionPage;
