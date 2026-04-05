const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1600, height: 1200 });

  const filePath = "file://" + path.resolve(__dirname, "ui-mockups.html");
  await page.goto(filePath, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Get all phone-frame elements
  const frames = await page.$$(".phone-frame");
  console.log(`Found ${frames.length} phone frames`);

  for (let i = 0; i < frames.length; i++) {
    const name =
      (i + 1).toString().padStart(2, "0") +
      "-" +
      ["home", "detection", "settings", "stats", "alert", "achievement"][i];
    await frames[i].screenshot({ path: `${name}.png`, omitBackground: false });
    console.log(`✓ Captured: ${name}.png`);
  }

  await browser.close();
  console.log("All done!");
})().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
