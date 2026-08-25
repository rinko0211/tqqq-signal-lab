import { mkdir, writeFile } from "node:fs/promises";
import { phase15Bundle } from "../lib/phase1-5.ts";
import { fetchOfficialData } from "../lib/official-data.ts";

const pagesRoot = new URL("../github-pages/public/data/", import.meta.url);
const roots = process.env.GITHUB_ACTIONS === "true"
  ? [pagesRoot]
  : [pagesRoot, new URL("../public/data/", import.meta.url)];
await Promise.all(roots.map((x) => mkdir(x, { recursive: true })));

const payload = await fetchOfficialData(true);
const report = phase15Bundle(payload);
await Promise.all(roots.map((x) =>
  writeFile(new URL("phase-1-5-common-strategy.json", x), JSON.stringify(report, null, 2) + "\n"),
));
console.log(`Phase 1.5 generated: ${report.rows.length} ticker-family rows, common end ${report.commonPeriod.end || "n/a"}`);
