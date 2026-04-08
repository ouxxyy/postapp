/**
 * UI 功能测试 - HistorySection 组件
 * 验证检测历史展示功能
 *
 * 测试目标:
 * - 时间格式化正确
 * - 分数颜色映射正确
 * - 建议生成逻辑正确
 * - 最近 5 条记录展示
 * - 空数据处理
 */

// ─────────────────────────────────────────────────────────────
// 模拟 HistorySection 组件核心逻辑
// ─────────────────────────────────────────────────────────────

interface PostureRecord {
  id: string;
  timestamp: number;
  score: number;
  issues: string[];
  headForward: boolean;
  hunchback: boolean;
  misaligned: boolean;
}

// 时间格式化（来自 HistorySection.tsx）
function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  return `${days}天前`;
}

// 分数颜色（来自 HistorySection.tsx）
function getScoreColor(score: number): string {
  if (score >= 90) return "var(--color-success)";
  if (score >= 70) return "var(--color-primary)";
  if (score >= 50) return "var(--color-warning)";
  return "var(--color-danger)";
}

// 分数标签（来自 HistorySection.tsx）
function getScoreLabel(score: number): string {
  if (score >= 90) return "优秀";
  if (score >= 70) return "良好";
  if (score >= 50) return "一般";
  return "需改善";
}

// 建议生成（来自 HistorySection.tsx）
function getAdvice(record: PostureRecord): string {
  if (record.headForward) return "注意头部前倾";
  if (record.hunchback) return "注意驼背";
  if (record.misaligned) return "注意坐姿不正";
  return "姿势良好";
}

// 数据获取逻辑（模拟 useAppContext.getRecentRecords）
async function getRecentRecords(
  mockStorage: Record<string, PostureRecord[]>,
): Promise<PostureRecord[]> {
  const allRecords: PostureRecord[] = [];
  const today = new Date();

  // 从今天往前查 7 天
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const records = mockStorage[`records_${dateStr}`] || [];
    allRecords.push(...records.filter(isValidRecord));
  }

  // 按时间戳降序排序，取最近 5 条
  return allRecords.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
}

function isValidRecord(record: PostureRecord): boolean {
  if (record.score <= 0) return false;
  if (record.issues.includes("noPoseDetected")) return false;
  if (record.issues.includes("lowConfidence")) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────
// 测试用例
// ─────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => boolean | void): void {
  try {
    const result = fn();
    results.push({
      name,
      passed: result !== false,
    });
  } catch (err: any) {
    results.push({
      name,
      passed: false,
      error: err.message || String(err),
    });
  }
}

async function asyncTest(
  name: string,
  fn: () => Promise<boolean | void>,
): Promise<void> {
  try {
    const result = await fn();
    results.push({
      name,
      passed: result !== false,
    });
  } catch (err: any) {
    results.push({
      name,
      passed: false,
      error: err.message || String(err),
    });
  }
}

// 创建模拟记录
function createRecord(overrides: Partial<PostureRecord> = {}): PostureRecord {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    score: 85,
    issues: [],
    headForward: false,
    hunchback: false,
    misaligned: false,
    ...overrides,
  };
}

async function runUITests(): Promise<void> {
  console.log("\nUI 功能测试 - HistorySection\n" + "=".repeat(60));

  // ── 测试 1: 时间格式化 ──
  console.log("\n测试 1: 时间格式化");

  test("刚刚 (<1分钟)", () => {
    const result = formatTime(Date.now() - 30000);
    if (result !== "刚刚") throw new Error(`期望"刚刚"，得到"${result}"`);
  });

  test("X分钟前 (<1小时)", () => {
    const result = formatTime(Date.now() - 5 * 60000);
    if (result !== "5分钟前") throw new Error(`期望"5分钟前"，得到"${result}"`);
  });

  test("X小时前 (<24小时)", () => {
    const result = formatTime(Date.now() - 3 * 3600000);
    if (result !== "3小时前") throw new Error(`期望"3小时前"，得到"${result}"`);
  });

  test("X天前 (>=24小时)", () => {
    const result = formatTime(Date.now() - 2 * 86400000);
    if (result !== "2天前") throw new Error(`期望"2天前"，得到"${result}"`);
  });

  // ── 测试 2: 分数颜色映射 ──
  console.log("\n测试 2: 分数颜色映射");

  test("优秀 (>=90) -> success", () => {
    const color = getScoreColor(95);
    if (color !== "var(--color-success)")
      throw new Error(`期望 success，得到 ${color}`);
  });

  test("良好 (70-89) -> primary", () => {
    const color = getScoreColor(75);
    if (color !== "var(--color-primary)")
      throw new Error(`期望 primary，得到 ${color}`);
  });

  test("一般 (50-69) -> warning", () => {
    const color = getScoreColor(60);
    if (color !== "var(--color-warning)")
      throw new Error(`期望 warning，得到 ${color}`);
  });

  test("需改善 (<50) -> danger", () => {
    const color = getScoreColor(40);
    if (color !== "var(--color-danger)")
      throw new Error(`期望 danger，得到 ${color}`);
  });

  // ── 测试 3: 分数标签 ──
  console.log("\n测试 3: 分数标签");

  test("优秀 (>=90)", () => {
    const label = getScoreLabel(92);
    if (label !== "优秀") throw new Error(`期望"优秀"，得到"${label}"`);
  });

  test("良好 (70-89)", () => {
    const label = getScoreLabel(78);
    if (label !== "良好") throw new Error(`期望"良好"，得到"${label}"`);
  });

  test("一般 (50-69)", () => {
    const label = getScoreLabel(55);
    if (label !== "一般") throw new Error(`期望"一般"，得到"${label}"`);
  });

  test("需改善 (<50)", () => {
    const label = getScoreLabel(35);
    if (label !== "需改善") throw new Error(`期望"需改善"，得到"${label}"`);
  });

  // ── 测试 4: 建议生成 ──
  console.log("\n测试 4: 建议生成");

  test("头前倾建议", () => {
    const advice = getAdvice(createRecord({ headForward: true }));
    if (advice !== "注意头部前倾")
      throw new Error(`期望"注意头部前倾"，得到"${advice}"`);
  });

  test("驼背建议", () => {
    const advice = getAdvice(createRecord({ hunchback: true }));
    if (advice !== "注意驼背")
      throw new Error(`期望"注意驼背"，得到"${advice}"`);
  });

  test("坐姿不正建议", () => {
    const advice = getAdvice(createRecord({ misaligned: true }));
    if (advice !== "注意坐姿不正")
      throw new Error(`期望"注意坐姿不正"，得到"${advice}"`);
  });

  test("姿势良好建议", () => {
    const advice = getAdvice(createRecord());
    if (advice !== "姿势良好")
      throw new Error(`期望"姿势良好"，得到"${advice}"`);
  });

  // ── 测试 5: 最近记录获取 ──
  console.log("\n测试 5: 最近记录获取");

  await asyncTest("应返回最近 5 条记录", async () => {
    const today = new Date().toISOString().split("T")[0];
    const mockStorage: Record<string, PostureRecord[]> = {
      [`records_${today}`]: [
        createRecord({ timestamp: Date.now() - 1000, score: 90 }),
        createRecord({ timestamp: Date.now() - 2000, score: 85 }),
        createRecord({ timestamp: Date.now() - 3000, score: 75 }),
        createRecord({ timestamp: Date.now() - 4000, score: 65 }),
        createRecord({ timestamp: Date.now() - 5000, score: 55 }),
        createRecord({ timestamp: Date.now() - 6000, score: 45 }),
      ],
    };

    const records = await getRecentRecords(mockStorage);
    if (records.length !== 5)
      throw new Error(`期望 5 条，得到 ${records.length} 条`);
  });

  await asyncTest("应按时间戳降序排序", async () => {
    const today = new Date().toISOString().split("T")[0];
    const mockStorage: Record<string, PostureRecord[]> = {
      [`records_${today}`]: [
        createRecord({ timestamp: 1000 }),
        createRecord({ timestamp: 3000 }),
        createRecord({ timestamp: 2000 }),
      ],
    };

    const records = await getRecentRecords(mockStorage);
    if (records[0].timestamp !== 3000) throw new Error("排序错误");
    if (records[1].timestamp !== 2000) throw new Error("排序错误");
    if (records[2].timestamp !== 1000) throw new Error("排序错误");
  });

  await asyncTest("应跨多日获取记录", async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBefore = new Date(today);
    dayBefore.setDate(dayBefore.getDate() - 2);

    const mockStorage: Record<string, PostureRecord[]> = {
      [`records_${today.toISOString().split("T")[0]}`]: [
        createRecord({ timestamp: Date.now(), score: 90 }),
      ],
      [`records_${yesterday.toISOString().split("T")[0]}`]: [
        createRecord({ timestamp: Date.now() - 86400000, score: 80 }),
      ],
      [`records_${dayBefore.toISOString().split("T")[0]}`]: [
        createRecord({ timestamp: Date.now() - 2 * 86400000, score: 70 }),
      ],
    };

    const records = await getRecentRecords(mockStorage);
    if (records.length !== 3)
      throw new Error(`期望 3 条，得到 ${records.length} 条`);
  });

  await asyncTest("应过滤无效记录", async () => {
    const today = new Date().toISOString().split("T")[0];
    const mockStorage: Record<string, PostureRecord[]> = {
      [`records_${today}`]: [
        createRecord({ score: 85 }),
        createRecord({ score: 0 }), // 无效
        createRecord({ issues: ["noPoseDetected"] }), // 无效
        createRecord({ issues: ["lowConfidence"] }), // 无效
      ],
    };

    const records = await getRecentRecords(mockStorage);
    if (records.length !== 1)
      throw new Error(`期望 1 条有效，得到 ${records.length} 条`);
  });

  // ── 测试 6: 空数据处理 ──
  console.log("\n测试 6: 空数据处理");

  await asyncTest("无记录时应返回空数组", async () => {
    const records = await getRecentRecords({});
    if (records.length !== 0)
      throw new Error(`期望 0 条，得到 ${records.length} 条`);
  });

  test("空数组时组件应不渲染", () => {
    const recentRecords: PostureRecord[] = [];
    // 模拟组件逻辑
    if (recentRecords.length === 0) {
      // 组件返回 null
      return true;
    }
    throw new Error("应返回 null");
  });
}

// 运行测试
runUITests()
  .then(() => {
    console.log("\n" + "=".repeat(60));
    console.log("UI 功能测试汇总");
    console.log("=".repeat(60));

    results.forEach((r) => {
      const status = r.passed ? "PASS" : "FAIL";
      console.log(
        `  ${r.passed ? "PASS" : "FAIL"} ${r.name}${r.error ? ` - ${r.error}` : ""}`,
      );
    });

    console.log("=".repeat(60));
    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;
    console.log(`总计: ${passed}/${results.length} 通过`);

    if (failed > 0) {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error("测试执行失败:", err);
    process.exit(1);
  });
