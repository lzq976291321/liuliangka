import { readFile } from "node:fs/promises";
import path from "node:path";

const input = process.argv[2] || path.join(process.cwd(), ".data", "events.jsonl");
const names = { channel_visit: "渠道进入页面", catalog_zero_results: "筛选无结果", comparison_open: "打开对比", apply_click: "点击办理" };
const counts = new Map(Object.keys(names).map((event) => [event, { events: 0, visitors: new Set() }]));
let invalidLines = 0;
try {
  const text = await readFile(input, "utf8");
  for (const line of text.split("\n").filter(Boolean)) {
    try {
      const event = JSON.parse(line.replace(/^.*?track_event\s+/, ""));
      const count = counts.get(event.event);
      if (!count) continue;
      count.events += 1;
      if (typeof event.userId === "string") count.visitors.add(event.userId);
    } catch { invalidLines += 1; }
  }
  console.table(Object.entries(names).map(([event, label]) => ({ event, label, events: counts.get(event).events, visitors: counts.get(event).visitors.size })));
  if (invalidLines) console.info(`跳过 ${invalidLines} 行无法识别的记录。`);
  console.info("点击办理不代表提交订单或激活成功；这些是独立事件计数，不是严格顺序漏斗。");
} catch (error) {
  if (error.code === "ENOENT") console.info("还没有事件文件。开发模式互动后重试，或传入导出的生产日志路径。");
  else throw error;
}
