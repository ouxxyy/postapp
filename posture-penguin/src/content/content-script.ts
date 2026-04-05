// Content Script for PosturePenguin
// 注入到页面中，处理页面内的姿势检测和提醒

import "./content-script.css";

// 检测提醒弹窗容器
let alertContainer: HTMLDivElement | null = null;

// 创建提醒弹窗
function createAlertModal(message: string, score: number, issues: string[]) {
  // 移除已有的弹窗
  removeAlertModal();

  // 创建容器
  alertContainer = document.createElement("div");
  alertContainer.id = "posture-penguin-alert";
  alertContainer.innerHTML = `
    <div class="pp-modal-overlay">
      <div class="pp-modal">
        <div class="pp-penguin">🐧</div>
        <p class="pp-message">${message}</p>
        <div class="pp-score">姿势评分: <strong>${score}</strong></div>
        <button class="pp-close-btn">我知道了</button>
      </div>
    </div>
  `;

  // 添加样式
  const style = document.createElement("style");
  style.textContent = `
    #posture-penguin-alert {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2147483647;
      pointer-events: none;
    }
    .pp-modal-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      animation: ppFadeIn 0.2s ease-out;
    }
    @keyframes ppFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .pp-modal {
      background: #fff;
      border-radius: 20px;
      padding: 24px;
      max-width: 320px;
      text-align: center;
      box-shadow: 0 12px 40px rgba(0,0,0,0.2);
      animation: ppSlideUp 0.3s ease-out;
    }
    @keyframes ppSlideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .pp-penguin {
      font-size: 64px;
      margin-bottom: 12px;
      animation: ppWaddle 0.5s ease-in-out infinite;
    }
    @keyframes ppWaddle {
      0%, 100% { transform: rotate(-5deg); }
      50% { transform: rotate(5deg); }
    }
    .pp-message {
      font-size: 16px;
      color: #2d3f4f;
      margin-bottom: 12px;
      line-height: 1.5;
    }
    .pp-score {
      font-size: 14px;
      color: #5b7a8a;
      margin-bottom: 16px;
    }
    .pp-score strong {
      font-size: 24px;
      color: #ff8a9b;
    }
    .pp-close-btn {
      background: #ff8a9b;
      color: white;
      border: none;
      padding: 12px 32px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .pp-close-btn:hover {
      background: #e67084;
      transform: scale(1.05);
    }
  `;
  alertContainer.appendChild(style);

  // 添加关闭事件
  const closeBtn = alertContainer.querySelector(".pp-close-btn");
  closeBtn?.addEventListener("click", removeAlertModal);

  document.body.appendChild(alertContainer);

  // 5秒后自动关闭
  setTimeout(removeAlertModal, 5000);
}

// 移除提醒弹窗
function removeAlertModal() {
  if (alertContainer) {
    alertContainer.remove();
    alertContainer = null;
  }
}

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PERFORM_CHECK") {
    // 通知 popup 进行检测
    console.log("收到检测请求");
    sendResponse({ status: "ready" });
    return true;
  }

  if (message.type === "SHOW_ALERT") {
    createAlertModal(message.message, message.score, message.issues);
    sendResponse({ status: "shown" });
    return true;
  }

  return false;
});

console.log("姿势企鹅 Content Script 已加载");
