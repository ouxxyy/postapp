/**
 * 使用 Playwright 拦截网络请求下载 MoveNet 模型
 *
 * 当 TensorFlow.js 加载模型时，拦截所有网络请求并保存模型文件
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const MODEL_DIR = path.join(
  __dirname,
  "../public/models/movenet-singlepose-lightning",
);

async function downloadModel() {
  console.log("🚀 启动浏览器自动下载模型...\n");
  console.log("目标目录:", MODEL_DIR, "\n");

  // 确保目录存在
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 拦截网络请求，保存模型文件
  const modelFiles = {};

  page.on("response", async (response) => {
    const url = response.url();

    // 检查是否是模型文件
    if (
      url.includes("model.json") ||
      url.includes(".bin") ||
      url.includes("group")
    ) {
      const fileName = url.split("/").pop().split("?")[0];

      // 避免重复下载
      if (!modelFiles[fileName]) {
        console.log(`📥 发现模型文件: ${fileName}`);
        try {
          const buffer = await response.body();
          const filePath = path.join(MODEL_DIR, fileName);
          fs.writeFileSync(filePath, buffer);
          modelFiles[fileName] = buffer.length;
          console.log(
            `✅ 已保存: ${fileName} (${(buffer.length / 1024).toFixed(2)} KB)`,
          );
        } catch (err) {
          console.error(`❌ 保存失败 ${fileName}:`, err.message);
        }
      }
    }
  });

  // 创建一个简单的加载页面
  console.log("📄 加载 TensorFlow.js 并下载模型...");

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js"></script>
    </head>
    <body>
      <script>
        async function loadModel() {
          try {
            console.log('开始加载 MoveNet 模型...');
            const model = await tf.loadGraphModel(
              'https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4',
              { fromTFHub: true }
            );
            console.log('模型加载完成！');
            window.modelLoaded = true;

            // 运行一次推理确保模型完全加载
            const input = tf.zeros([1, 192, 192, 3]);
            await model.predict(input);
            input.dispose();
            console.log('模型预热完成！');
            window.modelReady = true;
          } catch (err) {
            console.error('模型加载失败:', err);
            window.modelError = err.message;
          }
        }
        loadModel();
      </script>
    </body>
    </html>
  `);

  // 等待模型加载
  console.log("⏳ 等待模型加载...");
  try {
    await page.waitForFunction(() => window.modelReady || window.modelError, {
      timeout: 120000,
    });

    const error = await page.evaluate(() => window.modelError);
    if (error) {
      throw new Error(error);
    }

    console.log("🎉 模型加载完成！");
  } catch (err) {
    console.error("❌ 模型加载失败:", err.message);
  }

  // 等待一下确保所有文件都保存
  await page.waitForTimeout(2000);

  await browser.close();

  // 检查下载的文件
  console.log("\n📋 已下载的文件:");
  let totalSize = 0;
  for (const [file, size] of Object.entries(modelFiles)) {
    console.log(`  - ${file} (${(size / 1024).toFixed(2)} KB)`);
    totalSize += size;
  }

  if (totalSize === 0) {
    console.log("  ❌ 没有下载到任何文件");
    process.exit(1);
  }

  console.log(`\n📊 总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📁 保存位置: ${MODEL_DIR}`);
  console.log("\n✅ 模型下载完成！");
}

downloadModel().catch((err) => {
  console.error("❌ 下载失败:", err.message);
  process.exit(1);
});
