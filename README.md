# Posture Penguin 🐧

**姿势企鹅** —— 一个温柔可爱的 Chrome 浏览器坐姿监测插件，帮助你在工作时保持良好坐姿。

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](https://opensource.org/licenses/MIT)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-blue.svg)](https://chrome.google.com/webstore)

---

## 🎯 为什么需要姿势企鹅？

长时间坐在电脑前，很容易不知不觉就头前倾、驼背、坐姿歪斜——等你发现时，脖子和腰已经酸了。

姿势企鹅用 AI + 可爱的企鹅吉祥物，**定时温柔地提醒你**，让你在不影响工作节奏的前提下，慢慢养成好坐姿。

---

## ✨ 功能特性

| 功能                | 说明                                         |
| ------------------- | -------------------------------------------- |
| ⏰ **定时姿势检测** | 自动定时拍照，检测你的坐姿状态               |
| 🤖 **本地 AI 识别** | 使用 MediaPipe BlazePose，图像不离开你的电脑 |
| 🔔 **温柔提醒**     | 小企鹅动画 + 柔和音效，不打断工作            |
| 📊 **数据统计**     | 姿势评分趋势图、周报 / 月报分析              |
| 🔒 **隐私保护**     | 所有图像处理在本地完成，不上传任何数据       |
| 🐧 **可爱设计**     | 珊瑚粉配色，企鹅吉祥物，女性友好风格         |

---

## 🛠 安装

### 方式一：从源码安装

```bash
# 克隆项目
git clone https://github.com/ouxxyy/postapp.git
cd postapp/posture-penguin

# 安装依赖
npm install

# 开发构建（监听文件变化）
npm run dev

# 或生产构建
npm run build
```

### 方式二：加载到 Chrome

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的 **「开发者模式」**
3. 点击 **「加载已解压的扩展程序」**
4. 选择项目的 `dist` 目录

---

## 📁 项目结构

```
postapp/
├── posture-penguin/          # Chrome 扩展主目录
│   ├── src/                  # 源代码
│   │   ├── popup/            # 弹窗页面 (React)
│   │   ├── background/       # Service Worker
│   │   ├── content/          # Content Script
│   │   ├── components/       # React 组件
│   │   ├── lib/              # 核心算法 (MediaPipe BlazePose)
│   │   └── offscreen/        # 离屏页面
│   ├── dist/                 # 构建产物目录
│   └── package.json
└── README.md                  # 本文件
```

---

## 🧠 技术栈

| 技术                         | 用途            |
| ---------------------------- | --------------- |
| React 18 + TypeScript        | 界面开发        |
| Webpack 5                    | 构建打包        |
| MediaPipe BlazePose          | 本地姿势识别 AI |
| Recharts                     | 数据可视化      |
| Chrome Extension Manifest V3 | 浏览器扩展平台  |

---

## 🔒 隐私说明

- ✅ 所有图像处理均在 **浏览器本地** 完成
- ✅ 不上传任何图像或视频数据到服务器
- ✅ 姿势记录仅存储在本地 Chrome Storage
- ✅ 历史数据 90 天后自动清理

---

## 📮 联系我们 & 意见反馈

扫码关注公众号，提交使用建议或问题反馈：

![公众号二维码](posture-penguin/dist/qrcode.jpg)

> 有任何功能建议、Bug 反馈，或想了解坐姿改善技巧，欢迎来信！

---

## 📄 开源协议

MIT License —— 欢迎 fork、star，也欢迎提交 PR！

---

**姿势企鹅** —— 用温柔的方式，让你慢慢变好 🐧
