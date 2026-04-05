# 姿势企鹅 (PosturePenguin) 🐧

一个可爱的 Chrome 浏览器坐姿监测插件，帮助你在工作时保持良好坐姿。

## 功能特性

- **定时姿势检测** - 自动定时拍照检测你的坐姿
- **实时姿势识别** - 使用 MediaPipe BlazePose 本地 AI 算法
- **温柔提醒** - 小企鹅动画 + 柔和音效，不打断工作
- **数据统计** - 姿势评分趋势图、周月报
- **隐私保护** - 所有图像处理均在本地完成，不上传服务器
- **女性友好设计** - 珊瑚粉配色，可爱的企鹅吉祥物

## 技术栈

- **框架**: React 18 + TypeScript
- **构建**: Webpack 5
- **平台**: Chrome Extension Manifest V3
- **AI 算法**: MediaPipe BlazePose
- **图表**: Recharts
- **存储**: Chrome Storage API

## 安装

### 开发模式

```bash
# 安装依赖
npm install

# 开发构建（监听文件变化）
npm run dev

# 生产构建
npm run build
```

### 加载到 Chrome

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目的 `dist` 目录

## 项目结构

```
posture-penguin/
├── public/
│   ├── manifest.json      # Chrome 扩展配置
│   ├── popup.html         # Popup HTML 模板
│   └── icons/             # 扩展图标
├── src/
│   ├── popup/             # Popup 页面
│   │   ├── App.tsx        # 主应用组件
│   │   └── index.tsx      # 入口文件
│   ├── background/        # Service Worker
│   │   └── service-worker.ts
│   ├── content/           # Content Script
│   │   └── content-script.ts
│   ├── components/        # React 组件
│   │   ├── HomePage.tsx   # 主页
│   │   ├── DetectionPage.tsx # 检测页
│   │   ├── SettingsPage.tsx # 设置页
│   │   ├── StatsPage.tsx  # 统计页
│   │   └── AlertModal.tsx # 提醒弹窗
│   ├── hooks/             # React Hooks
│   │   └── useAppContext.tsx # 全局状态
│   ├── lib/               # 核心库
│   │   └── PostureDetector.ts # 姿势检测
│   └── styles/            # 全局样式
│       └── global.css
├── package.json
├── tsconfig.json
└── webpack.config.js
```

## 核心功能

### 姿势检测算法

使用 MediaPipe BlazePose 进行实时姿势识别，检测：

- **头前倾** - 计算耳朵与肩膀的位置关系
- **驼背** - 肩膀高度差分析
- **坐姿不正** - 身体中线偏移检测

### 评分系统

| 分数范围 | 等级   | 颜色    |
| -------- | ------ | ------- |
| 90-100   | 优秀   | 🟢 绿色 |
| 70-89    | 良好   | 🔵 蓝色 |
| 50-69    | 一般   | 🟠 橙色 |
| <50      | 需改善 | 🔴 红色 |

## 隐私保护

- ✅ 所有图像处理均在浏览器本地完成
- ✅ 不上传任何图像或视频数据
- ✅ 姿势记录仅存储在本地 Chrome Storage
- ✅ 90天后自动清理旧数据

## 许可证

MIT License

---

**姿势企鹅** - 用温柔的方式，让你慢慢变好 🐧
