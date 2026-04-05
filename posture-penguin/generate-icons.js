// 生成简单的 PNG 图标
// 使用 canvas 在 Node.js 中生成图标

const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const sizes = [16, 32, 48, 128];
const outputDir = path.join(__dirname, "dist", "icons");

// 确保目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

sizes.forEach((size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // 绘制圆形背景
  ctx.fillStyle = "#ff8a9b";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // 绘制企鹅 emoji
  ctx.fillStyle = "#ffffff";
  ctx.font = `${size * 0.6}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🐧", size / 2, size / 2);

  // 保存为 PNG
  const buffer = canvas.toBuffer("image/png");
  const filename = path.join(outputDir, `icon${size}.png`);
  fs.writeFileSync(filename, buffer);
  console.log(`Created ${filename}`);
});

console.log("Icons generated successfully!");
