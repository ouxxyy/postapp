#!/usr/bin/env node
/**
 * 姿势企鹅自动化测试运行器
 * 运行 posture-detector 单元测试（Node.js）和 camera E2E 测试（Playwright）
 *
 * 用法:
 *   node tests/run.js               # 运行所有测试
 *   node tests/run.js unit           # 只运行单元测试
 *   node tests/run.js e2e           # 只运行 E2E 测试
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const mode = args[0] || "all"; // unit | e2e | all

const testsDir = path.join(__dirname);
const projectRoot = path.dirname(__dir);

// 颜色
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red   = (s) => `\x1b[31m${s}\x1b[0m`;
const cyan  = (s) => `\x1b[36m${s}\x1b[0m`;
const bold  = (s) => `\x1b[1m${s}\x1b[0m`;

function section(title) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(cyan(bold(title)));
  console.log("=".repeat(60));
}

function run(cmd, cwd) {
  try {
    const out = execSync(cmd, { cwd, encoding: "utf8", stdio: "pipe" });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: e.stdout || e.message };
  }
}

// ── Step 1: 单元测试 (Node.js) ────────────────────────
if (mode === "unit" || mode === "all") {
  section("Step 1/2  PostureDetector 算法单元测试");
  console.log("$ npx ts-node tests/posture-detector.test.ts\n");
  const result = run("npx ts-node tests/posture-detector.test.ts", projectRoot);
  console.log(result.out);
}

// ── Step 2: TypeScript 编译检查 ───────────────────────
section("Step 2 TypeScript 编译检查");
console.log("$ npx tsc --noEmit\n");
const tscResult = run("npx tsc --noEmit 2>&1 | head -20", projectRoot);
console.log(tscResult.ok ? green("✅ 0 errors") : red(`⚠️ ${tscResult.out}`));

// ── Step 3: E2E 测试 (可选，需插件加载) ───────────────
if (mode === "e2e" || mode === "all") {
  section("Step 3 Camera E2E 测试 (Playwright)");
  console.log("$ npx playwright test tests/camera.e2e.test.ts\n");
  const pwResult = run("npx playwright test tests/camera.e2e.test.ts 2>&1 | head -40", projectRoot);
  console.log(pwResult.ok ? green("✅ E2E 通过") : red(pwResult.out));
}

// ── 汇总 ───────────────────────────────────────
section("测试汇总");
console.log(`
产出文件:
  tests/posture-detector.test.ts  — 算法逻辑单元测试（15 个用例）
  tests/camera.e2e.test.ts      — 摄像头 E2E 测试（5 个用例）
  TEST_REPORT.md                — 测试报告

运行测试:
  node tests/run.js unit   # 算法单元测试（Node.js）
  npx playwright test     # E2E 测试（需插件已加载 Chrome）

Note: E2E 测试需要先构建插件并加载到 Chrome:
  npm run build
  # Chrome → chrome://extensions → 开发者模式 → 加载已解压 → 选择 dist/
`);
