# Chrome Web Store 上架素材清单 — 姿势企鹅 v1.0.2

> 本文件为上架准备材料，无需执行上架操作时可直接参考。
> 整理日期：2026-04-21 | 版本：v1.0.2

---

## 1. 插件基本信息

| 字段              | 内容                                                                           | 备注                     |
| ----------------- | ------------------------------------------------------------------------------ | ------------------------ |
| **插件名称**      | 姿势企鹅 - PosturePenguin                                                      | ≤45 字符 ✅              |
| **版本号**        | 1.0.2                                                                          | manifest.json 中最新版本 |
| **Manifest 版本** | 3（MV3）                                                                       | ✅ 符合要求              |
| **简短描述**      | 一个可爱的企鹅助手，帮助你在工作时保持良好坐姿。定时检测、温柔提醒、数据统计。 | ≤132 字符 ✅             |

---

## 2. 完整描述（Store Listing Description）

```
🐧 姿势企鹅 — 让好姿势成为习惯

你在电脑前工作久了，是否常常不知不觉就驼背、头前倾？

姿势企鹅是一只可爱的企鹅助手，用温柔的方式帮助你保持良好坐姿。

━━━━━━━━━━━━━━━━━━━━━━━━

✨ 核心功能

📷 定时姿势检测
每20分钟（可自定义）自动提醒你检测坐姿，通过摄像头拍一张照片，本地AI实时分析。

🧠 本地姿势识别（不拍照不上传！）
使用 Google MoveNet AI 算法，所有图像处理在浏览器本地完成，绝不拍照不上传，隐私安全无忧。

🏆 姿势评分系统
每次检测后给出 0-100 分数，并标注问题类型：
  • 🔺 头前倾
  • 🔶 驼背
  • ↔️ 坐姿不正

📊 数据统计
  • 每日姿势评分
  • 7天/30天趋势图

🔔 温柔提醒
检测到问题时，小企鹅会弹出可爱的提醒弹窗，不打断你的工作节奏。

━━━━━━━━━━━━━━━━━━━━━━━━

🎨 设计理念

专为亚洲白领女性设计，采用珊瑚粉配色和可爱的企鹅吉祥物，让健康管理变得温暖愉悦。

💡 坐姿小建议（附赠）
  • 坐着时踮起脚尖，促进血液循环
  • 显示器顶部与眼睛平齐
  • 每45分钟起身活动5分钟

━━━━━━━━━━━━━━━━━━━━━━━━

🔒 隐私保护
  ✅ 所有图像本地处理，不上传任何服务器
  ✅ 姿势记录仅存在本地浏览器
  ✅ 90天后自动清理历史数据
  ✅ 无第三方追踪

━━━━━━━━━━━━━━━━━━━━━━━━

安装即表示您同意我们的隐私政策。

🐧 姿势企鹅 — 慢慢变好，每一次坐姿都算数
```

---

## 3. 关键词（Keywords）

```
坐姿,姿势检测,驼背,头前倾,健康,护颈,护腰,白领,办公,姿势提醒
posture,sitting posture,spine health,hunchback,neck pain,office health,posture check
```

---

## 4. 分类

| 字段               | 选择             |
| ------------------ | ---------------- |
| Primary Category   | Health & Fitness |
| Secondary Category | Productivity     |

---

## 5. 隐私政策 URL

**必须提供可公开访问的隐私政策页面 URL**

建议方案（三选一）：

1. ✅ 将 `PRIVACY_POLICY.md` 托管到 GitHub Pages（路径：`https://[your-github-username].github.io/postapp/privacy.html`）
2. 将隐私政策上传到可公开访问的云存储（需 HTTPS）
3. 在个人网站上创建单独的隐私政策页面

隐私政策页面参考内容已存于：`posture-penguin/PRIVACY_POLICY.md`

---

## 6. 单用途声明（Single Purpose）

> Chrome 审核要求：每个扩展必须有明确、单一的目的

**姿势企鹅的单用途声明：**

```
姿势企鹅是一款 Chrome 浏览器扩展，专注于帮助用户在长时间办公时保持良好坐姿。

单一功能：通过对摄像头图像进行本地 AI 姿势分析（MoveNet 模型），在用户坐姿不当时提供温柔的视觉提醒，并记录每日姿势评分趋势。
```

---

## 7. 权限说明对照表

| 权限                             | 用途                                   | 是否已在 manifest 中声明 |
| -------------------------------- | -------------------------------------- | ------------------------ |
| `storage`                        | 保存用户设置和历史数据                 | ✅                       |
| `alarms`                         | 定时触发姿势检测提醒                   | ✅                       |
| `notifications`                  | 发送姿势异常提醒通知                   | ✅                       |
| `tabs`                           | 管理扩展图标徽章状态                   | ✅                       |
| `offscreen`                      | 在后台文档中运行摄像头捕获（MV3 要求） | ✅                       |
| `camera`（optional_permissions） | 仅用于实时姿势检测，非强制             | ✅                       |

**注意：** 所有图像处理均在本地完成（TensorFlow.js MoveNet 模型），无网络请求发送图像数据。

---

## 8. 商店展示图片规格

| 材料       | 规格                         | 状态      | 文件路径                          |
| ---------- | ---------------------------- | --------- | --------------------------------- |
| 商店图标   | 128×128 PNG                  | ✅ 已准备 | `public/icons/icon128.png`        |
| 截图 1     | 1280×800 或 640×400 PNG/JPEG | ⏳ 待截取 | 建议：主页面（评分圆环+检测按钮） |
| 截图 2     | 1280×800 或 640×400 PNG/JPEG | ⏳ 待截取 | 建议：检测页面（摄像头+姿势骨架） |
| 截图 3     | 1280×800 或 640×400 PNG/JPEG | ⏳ 待截取 | 建议：数据统计页面（趋势图）      |
| 截图 4     | 1280×800 或 640×400 PNG/JPEG | ⏳ 待截取 | 建议：设置页面（间隔时间等）      |
| 小推广图   | 440×280 PNG/JPEG             | ⏳ 待制作 | 可用 icon128 扩展制作             |
| 横幅推广图 | 1400×560 PNG/JPEG            | ⬜ 可选   | 可选材料                          |

### 截图截取方法

1. 在 Chrome 中加载扩展（`chrome://extensions/` → 开发者模式 → 加载已解压的扩展程序 → 选择 `dist` 文件夹）
2. 点击扩展图标打开 popup 界面
3. 使用 Mac 截图（`Cmd+Shift+4`）或 Chrome 开发者工具截图
4. 如需 1280×800 的大图，可用截图工具拼接或使用开发者工具模拟设备尺寸

---

## 9. ZIP 包打包清单

### 已确认包含的文件（dist/ 目录）

```
manifest.json          ✅ MV3
background.js          ✅ Service Worker（MV3 兼容）
background.js.LICENSE.txt  ✅
content.js             ✅
content.css            ✅
popup.html             ✅
popup.js              ✅
popup.js.LICENSE.txt  ✅
popup.css             ✅
offscreen.html         ✅
offscreen.js           ✅
offscreen.js.LICENSE.txt  ✅
icons/
  icon16.png           ✅
  icon32.png           ✅
  icon48.png           ✅
  icon128.png          ⚠️ 尺寸正确但文件过小（1216 bytes），建议重新导出为高质量 PNG
models/
  movenet-singlepose-lightning/
    model.json         ✅
    group1-shard1of2.bin  ✅
    group1-shard2of2.bin  ✅
```

### ⚠️ 注意事项

- 图标文件过小（icon128.png 仅 1216 bytes），建议用图像编辑软件重新导出为标准 128×128 高质量 PNG
- `wasm-unsafe-eval` CSP 已在 manifest 中声明（用于 TensorFlow.js WebGL 运行）

### ZIP 打包命令

```bash
cd /Users/apple/Desktop/01_ActiveProjects/postapp/posture-penguin
npm run build    # 执行生产构建，输出到 dist/
# 然后在 Chrome Developer Dashboard 上传 dist.zip（由 Dashboard 自动打包）
# 或手动打包：
zip -r chrome-store.zip dist/
```

---

## 10. 审核注意事项

### 高风险点（容易导致审核被拒）

1. **`wasm-unsafe-eval` CSP** — MoveNet 使用 TensorFlow.js WebGL，需要此 CSP。若审核被拒，需提供说明文档证明这是检测算法必需。
2. **`camera` 权限** — 审核时会要求说明摄像头用途。说明：仅用于本地拍摄姿势照片，不上传网络。
3. **`offscreen` 文档** — MV3 要求在 offscreen.html 中处理摄像头，这是合规设计，不是风险。

### 通过审核的建议

- 隐私政策页面必须有真实可访问的 HTTPS URL
- 单用途声明要清晰、简洁，不要夸大功能
- 截图展示真实 UI，不要用模拟图

---

## 11. 上架检查清单（Submitter 填写）

- [ ] 已注册 Chrome Web Store 开发者账号（$5 注册费已付）
- [ ] manifest.json 为 Manifest V3
- [ ] 版本号已更新（≥ 上次提交版本）
- [ ] 商店图标 128×128 PNG 已准备（如重新导出）
- [ ] 至少 1 张截图已截取（建议 4 张）
- [ ] 隐私政策 URL 已托管并可访问
- [ ] 单用途声明已撰写
- [ ] 权限说明已对照 manifest 填写
- [ ] 详细描述已复制到 Dashboard
- [ ] 关键词已填写（中英文）
- [ ] 分类已选择（Health & Fitness / Productivity）
- [ ] ZIP 包已生成并上传
