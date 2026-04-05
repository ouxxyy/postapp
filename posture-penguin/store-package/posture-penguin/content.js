(() => {
  "use strict";
  let n = null;
  function e() {
    n && (n.remove(), (n = null));
  }
  (chrome.runtime.onMessage.addListener((t, o, p) =>
    "PERFORM_CHECK" === t.type
      ? (console.log("收到检测请求"), p({ status: "ready" }), !0)
      : "SHOW_ALERT" === t.type &&
        ((function (t, o) {
          (e(),
            (n = document.createElement("div")),
            (n.id = "posture-penguin-alert"),
            (n.innerHTML = `\n    <div class="pp-modal-overlay">\n      <div class="pp-modal">\n        <div class="pp-penguin">🐧</div>\n        <p class="pp-message">${t}</p>\n        <div class="pp-score">姿势评分: <strong>${o}</strong></div>\n        <button class="pp-close-btn">我知道了</button>\n      </div>\n    </div>\n  `));
          const p = document.createElement("style");
          ((p.textContent =
            "\n    #posture-penguin-alert {\n      position: fixed;\n      top: 0;\n      left: 0;\n      right: 0;\n      bottom: 0;\n      z-index: 2147483647;\n      pointer-events: none;\n    }\n    .pp-modal-overlay {\n      position: absolute;\n      top: 0;\n      left: 0;\n      right: 0;\n      bottom: 0;\n      background: rgba(0,0,0,0.3);\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      pointer-events: auto;\n      animation: ppFadeIn 0.2s ease-out;\n    }\n    @keyframes ppFadeIn {\n      from { opacity: 0; }\n      to { opacity: 1; }\n    }\n    .pp-modal {\n      background: #fff;\n      border-radius: 20px;\n      padding: 24px;\n      max-width: 320px;\n      text-align: center;\n      box-shadow: 0 12px 40px rgba(0,0,0,0.2);\n      animation: ppSlideUp 0.3s ease-out;\n    }\n    @keyframes ppSlideUp {\n      from { transform: translateY(20px); opacity: 0; }\n      to { transform: translateY(0); opacity: 1; }\n    }\n    .pp-penguin {\n      font-size: 64px;\n      margin-bottom: 12px;\n      animation: ppWaddle 0.5s ease-in-out infinite;\n    }\n    @keyframes ppWaddle {\n      0%, 100% { transform: rotate(-5deg); }\n      50% { transform: rotate(5deg); }\n    }\n    .pp-message {\n      font-size: 16px;\n      color: #2d3f4f;\n      margin-bottom: 12px;\n      line-height: 1.5;\n    }\n    .pp-score {\n      font-size: 14px;\n      color: #5b7a8a;\n      margin-bottom: 16px;\n    }\n    .pp-score strong {\n      font-size: 24px;\n      color: #ff8a9b;\n    }\n    .pp-close-btn {\n      background: #ff8a9b;\n      color: white;\n      border: none;\n      padding: 12px 32px;\n      border-radius: 12px;\n      font-size: 14px;\n      font-weight: 600;\n      cursor: pointer;\n      transition: all 0.15s;\n    }\n    .pp-close-btn:hover {\n      background: #e67084;\n      transform: scale(1.05);\n    }\n  "),
            n.appendChild(p));
          const s = n.querySelector(".pp-close-btn");
          (s?.addEventListener("click", e),
            document.body.appendChild(n),
            setTimeout(e, 5e3));
        })(t.message, t.score, t.issues),
        p({ status: "shown" }),
        !0),
  ),
    console.log("姿势企鹅 Content Script 已加载"));
})();
