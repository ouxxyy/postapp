# Chrome Web Store 上架提交完整文档

> 姿势企鹅 (PosturePenguin) v1.0.2 | Manifest V3
> 生成日期：2026-04-22

---

## 一、隐私政策（Privacy Policy）

> ⚠️ 此文件需要托管到**可公开访问的 URL**，推荐方式：
>
> - **GitHub Pages**（免费，推荐）：创建一个 GitHub 仓库 → 把 `PRIVACY_POLICY_EN.md` 放进去 → Settings → Pages → 启用
> - **Cloudflare Pages** / **Vercel** / **Netlify**：拖拽部署，免费
> - **Google Cloud Storage** / **阿里云 OSS**：上传后设为公开读取

### 英文版隐私政策（Chrome Web Store 审核要求英文）

```markdown
# Privacy Policy for PosturePenguin

**Last Updated:** April 22, 2026

## Overview

PosturePenguin ("we", "our", "the Extension") is a Chrome browser extension that helps users maintain good sitting posture through periodic posture detection using the device's camera. We are committed to protecting your privacy.

## Data Collection

**We do NOT collect, transmit, or share any personal data.**

Specifically:

- **Camera Images:** Camera images are processed **entirely on your local device** using TensorFlow.js (MoveNet model). Images are **never** uploaded, stored permanently, or transmitted to any server. Each image is analyzed in real-time and immediately discarded after analysis.
- **Posture Detection Results:** Detection scores and posture issue types are stored only in your browser's local storage (`chrome.storage.local`). This data never leaves your device.
- **Usage Analytics:** We do NOT use any analytics services, tracking pixels, or third-party data collection tools.
- **Third-Party Services:** We do NOT integrate with any third-party services, APIs, or cloud platforms.

## Data Storage

| Data Type                 | Storage Location                      | Retention                            |
| ------------------------- | ------------------------------------- | ------------------------------------ |
| User settings             | chrome.storage.local (device only)    | Until user clears browser data       |
| Posture detection records | chrome.storage.local (device only)    | Auto-deleted after 90 days           |
| Camera images             | Not stored — processed in memory only | Discarded immediately after analysis |

Users can manually delete all stored data at any time by clearing browser data or extension data.

## Permissions We Use

| Permission      | Purpose                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `storage`       | Save user preferences and posture detection history locally                                                                |
| `alarms`        | Schedule periodic posture check reminders and daily data cleanup                                                           |
| `notifications` | Display desktop posture reminder alerts                                                                                    |
| `tabs`          | Open full-tab pages for camera authorization prompts (popup windows are too small for permission dialogs)                  |
| `offscreen`     | Create an offscreen document to access camera and run TensorFlow.js (MV3 service workers cannot access camera or DOM APIs) |

## Host Permission (`<all_urls>`)

The extension uses a content script on all URLs to display in-page posture reminder alerts. The content script:

- Does NOT read, collect, or modify any page content
- Does NOT inject tracking code or access DOM data
- Only displays a small modal notification when a posture issue is detected
- The content script activates only when the user enables posture detection

## AI / Machine Learning

The extension uses TensorFlow.js with the MoveNet SinglePose Lightning model for posture detection. This model:

- Runs **entirely on your local device** (WebGL/CPU backend)
- Model files are bundled with the extension (not downloaded at runtime)
- No image data is sent to any server for processing

## Children's Privacy

This extension does not knowingly collect data from children under 13.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please contact us through the Chrome Web Store developer page or via email at the contact address listed on our store listing.

---

_PosturePenguin — Gentle guardian of your posture_
```

### 中文版隐私政策（如需同步提供）

已有文件：`/posture-penguin/PRIVACY_POLICY.md`，可直接使用或更新为上述英文版的中文对应版本。

---

## 二、权限理由（Permission Justifications）

以下内容对应 Chrome Web Store Developer Dashboard → **Privacy practices** 标签页中的每项要求。

### 1. Alarms（定时器）

**Justification（英文，填写到 Dashboard）：**

> The `alarms` permission is used to schedule two recurring tasks:
>
> 1. **Periodic posture detection:** Creates a configurable alarm (default: every 20 minutes) that triggers automatic posture analysis via the device camera. When the alarm fires, the extension activates the camera, captures a frame, runs TensorFlow.js MoveNet posture analysis, saves the score locally, and notifies the user if poor posture is detected (score < 70).
> 2. **Automatic data cleanup:** Creates a daily alarm (every 24 hours) that automatically deletes posture detection records older than 90 days from local storage, ensuring user data does not accumulate indefinitely.
>
> Chrome MV3 service workers can be terminated at any time, making `setTimeout` unreliable. The `chrome.alarms` API is the only reliable way to schedule recurring tasks in Manifest V3.

---

### 2. Host Permission (`<all_urls>` in content_scripts)

**Justification（英文，填写到 Dashboard）：**

> The `<all_urls>` host permission is used by the content script to display in-page posture reminder alerts on whatever webpage the user is currently viewing.
>
> **What the content script does:**
>
> - Listens for `SHOW_ALERT` messages from the background service worker
> - When triggered, displays a small, non-intrusive modal notification showing the posture score and detected issues (e.g., forward head, slouching, uneven shoulders)
>
> **What the content script does NOT do:**
>
> - Does NOT read, collect, scrape, or modify any page content or DOM data
> - Does NOT inject tracking scripts, ads, or analytics code
> - Does NOT access cookies, form data, passwords, or personal information
> - Does NOT communicate with any external servers
>
> The broad match pattern is necessary because the extension cannot predict which website the user will be on when a posture reminder needs to be shown. The content script only activates when the user explicitly enables posture detection.

---

### 3. Notifications（通知）

**Justification（英文，填写到 Dashboard）：**

> The `notifications` permission is used exclusively for two user-facing notification types:
>
> 1. **Posture reminder notifications:** When a periodic or manual posture detection completes with a score below 70 (indicating poor posture), the extension shows a desktop notification with the specific score and detected posture issues (e.g., forward head tilt, slouching, uneven sitting). This is the core value proposition of the extension — alerting users to correct their posture.
> 2. **Error notifications:** If automatic detection encounters a technical issue (e.g., camera unavailable, detection model error), a low-priority notification informs the user that the check failed and will retry at the next scheduled interval.
>
> All notifications use `chrome.notifications.create()` with the extension's own penguin icon. No notifications contain ads, promotions, or content unrelated to posture health.

---

### 4. Offscreen（离屏文档）

**Justification（英文，填写到 Dashboard）：**

> The `offscreen` permission is required because Chrome Manifest V3 service workers **cannot access camera APIs or create DOM elements** (video, canvas). The extension needs both to perform posture detection:
>
> 1. **Camera access:** The offscreen document uses `navigator.mediaDevices.getUserMedia()` to access the user's webcam for capturing posture images.
> 2. **TensorFlow.js execution:** The MoveNet posture detection model requires a WebGL context (created from a `<canvas>` element) to run inference. This DOM dependency cannot be satisfied in a service worker.
>
> **Architecture:**
>
> - The service worker creates an offscreen document with reason `USER_MEDIA`
> - The offscreen document initializes the camera, loads the bundled MoveNet model, and performs posture analysis
> - Results are sent back to the service worker via `chrome.runtime.sendMessage`
> - The camera is released immediately after each analysis to avoid occupying it
>
> This is the officially recommended Chrome MV3 pattern for extensions that need camera or DOM access.

---

### 5. Remote Code Use（远程代码使用）

**Justification（英文，填写到 Dashboard）：**

> This extension does **NOT** load or execute any remote code at runtime.
>
> **Details:**
>
> - All JavaScript code is bundled within the extension package (`popup.js`, `background.js`, `content.js`, `offscreen.js`)
> - The TensorFlow.js MoveNet model files (`models/movenet-singlepose-lightning/`) are bundled locally within the extension and loaded via `chrome.runtime.getURL()`
> - No `eval()`, `importScripts()`, dynamic `import()`, or `fetch()` calls are used to load external code
> - No CDN URLs are accessed at runtime
> - No external scripts are injected into web pages
>
> The `wasm-unsafe-eval` directive in the Content Security Policy is a technical safeguard for TensorFlow.js WebGL backend compatibility. It does not indicate actual WASM usage or remote code loading. The extension's TensorFlow.js runs on the WebGL/CPU backend with all code bundled locally.
>
> The extension is fully self-contained and works offline with no internet connection required after installation.

---

### 6. Storage（存储）

**Justification（英文，填写到 Dashboard）：**

> The `storage` permission is used to persist user data locally in `chrome.storage.local`. No data is synced, uploaded, or shared.
>
> **Stored data:**
> | Key | Data | Purpose |
> |-----|------|---------|
> | `settings` | User preferences (detection interval, sound settings, daily time range) | Remember user configuration across sessions |
> | `detectionEnabled` | Boolean flag | Track whether periodic detection is active |
> | `records_YYYY-MM-DD` | Daily posture detection records (score, issues, timestamp) | Display posture history and trend charts to the user |
>
> All data is stored exclusively on the user's local device. Records older than 90 days are automatically cleaned up via the `alarms` permission. Users can delete all data at any time by clearing browser data.

---

### 7. Tabs（标签页）

**Justification（英文，填写到 Dashboard）：**

> The `tabs` permission is used exclusively to open new browser tabs for camera authorization flows.
>
> **Why this is needed:**
> The browser's camera permission prompt (`getUserMedia`) requires sufficient screen space to display the permission dialog. The extension's popup window is too small and may be dismissed before the user can interact with the permission prompt. Opening the extension's own `popup.html` page in a full browser tab (`chrome.tabs.create()`) provides adequate space for the permission dialog.
>
> **Specific usage:**
>
> - `chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?page=detection") })` — Opens a full-tab detection page for initial camera setup
> - `chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?requestCamera=true") })` — Opens a tab specifically to trigger the camera permission prompt
>
> The extension does NOT read tab content, monitor browsing history, access tab URLs, or interact with tabs beyond opening its own extension pages.

---

## 三、单一用途描述（Single Purpose Description）

**英文（填写到 Dashboard "Single purpose" 字段）：**

> PosturePenguin monitors the user's sitting posture using the device camera and local AI (TensorFlow.js MoveNet). It periodically captures a camera frame, analyzes body posture in real-time entirely on-device, calculates a posture score, and alerts the user when poor posture is detected — helping users build healthier sitting habits during computer work.

**中文参考（如需）：**

> 姿势企鹅使用设备摄像头和本地 AI（TensorFlow.js MoveNet）监测用户坐姿。它定期捕获摄像头画面，在设备本地实时分析身体姿势，计算姿势评分，并在检测到不良坐姿时提醒用户——帮助用户在电脑工作期间养成更健康的坐姿习惯。

---

## 四、数据使用合规认证（Data Usage Certification）

在 **Privacy practices** 标签页底部，你会看到需要勾选的认证声明。对照实际情况：

### 认证勾选项参考

| 问题                                                                  | 回答         | 说明                       |
| --------------------------------------------------------------------- | ------------ | -------------------------- |
| Do you collect or transmit user data?                                 | **No**       | 所有数据仅本地存储，不上传 |
| Is your data use limited to the single purpose described?             | **Yes**      | 仅用于姿势检测和提醒       |
| Do you sell or share user data with third parties?                    | **No**       | 无第三方数据共享           |
| Do you use user data for advertising?                                 | **No**       | 无广告                     |
| Is your data use compliant with applicable privacy laws?              | **Yes**      | 符合 GDPR、CCPA 等隐私法规 |
| Certify that your data usage complies with Developer Program Policies | **勾选确认** | 确保数据使用符合政策       |

---

## 五、联系邮箱（Contact Email）

> ⚠️ Chrome Web Store 要求：
>
> 1. 在 **Account** 标签页填写联系邮箱
> 2. 完成邮箱验证流程（Google 会发送验证邮件）

**建议操作步骤：**

1. 进入 Chrome Web Store Developer Dashboard → **Account** 标签页
2. 在 "Contact email" 字段填写你的邮箱
3. 点击验证按钮，去邮箱点击验证链接
4. 验证完成后才能发布扩展

---

## 六、完整提交清单

### Store Listing 标签页

| 项目                 | 内容                                                                           | 状态          |
| -------------------- | ------------------------------------------------------------------------------ | ------------- |
| Name                 | 姿势企鹅 - PosturePenguin                                                      | ✅            |
| Short description    | 🐧 温柔守护每一次坐姿。定时拍照 · 本地AI姿势检测 · 珊瑚粉可爱界面 · 统计趋势图 | ✅            |
| Detailed description | （见 STORE_LISTING.md）                                                        | ✅            |
| Category             | Health & Fitness                                                               | ✅            |
| Language             | Chinese (Simplified)                                                           | ✅            |
| Screenshots          | 至少 1 张 1280×720                                                             | ⬜ 需手动截图 |
| Small tile icon      | 128×128                                                                        | ✅            |
| Marquee image        | 1400×560 宣传图（可选）                                                        | ⬜ 可选       |

### Privacy practices 标签页

| 项目                          | 内容                    | 状态          |
| ----------------------------- | ----------------------- | ------------- |
| Single purpose                | （见上方第三节）        | ✅ 复制粘贴   |
| Alarms justification          | （见上方第二节第 1 项） | ✅ 复制粘贴   |
| Host permission justification | （见上方第二节第 2 项） | ✅ 复制粘贴   |
| Notifications justification   | （见上方第二节第 3 项） | ✅ 复制粘贴   |
| Offscreen justification       | （见上方第二节第 4 项） | ✅ 复制粘贴   |
| Remote code justification     | （见上方第二节第 5 项） | ✅ 复制粘贴   |
| Storage justification         | （见上方第二节第 6 项） | ✅ 复制粘贴   |
| Tabs justification            | （见上方第二节第 7 项） | ✅ 复制粘贴   |
| Data usage certification      | 勾选确认                | ⬜ 需手动勾选 |
| Privacy policy URL            | 需要托管隐私政策        | ⬜ 需部署     |

### Account 标签页

| 项目               | 内容         | 状态          |
| ------------------ | ------------ | ------------- |
| Contact email      | 填写并验证   | ⬜ 需手动操作 |
| Email verification | 完成验证流程 | ⬜ 需手动操作 |

---

## 七、隐私政策托管方案（3 种选择）

### 方案 A：GitHub Pages（推荐，免费）

```bash
# 1. 创建 GitHub 仓库
# 仓库名：posture-penguin-privacy-policy

# 2. 创建 index.md（内容为上方英文版隐私政策）

# 3. 启用 GitHub Pages
# Settings → Pages → Source: Deploy from branch → main → / (root)

# 4. 获得公开 URL
# https://<your-username>.github.io/posture-penguin-privacy-policy/
```

### 方案 B：Cloudflare Pages（免费，速度快）

1. 登录 Cloudflare Dashboard → Pages
2. 创建项目 → 直接上传
3. 上传包含 `index.html` 的文件夹
4. 获得公开 URL：`https://posture-penguin-privacy.pages.dev`

### 方案 C：直接用 GitHub Raw URL

```
https://raw.githubusercontent.com/<your-username>/posture-penguin-privacy-policy/main/PRIVACY_POLICY.md
```

> ⚠️ 注意：Chrome Web Store 需要的是 **可公开访问的 URL**，任何方案都可以，只要填入 Dashboard 时能正常打开即可。

---

_文档生成日期：2026-04-22 | 姿势企鹅 v1.0.2_
