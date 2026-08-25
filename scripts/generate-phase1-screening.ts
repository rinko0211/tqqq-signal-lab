import { mkdir, writeFile } from "node:fs/promises";
import { phase1ScreeningBundle } from "../lib/phase1-screening.ts";
import { fetchOfficialData } from "../lib/official-data.ts";

const pagesRoot = new URL("../github-pages/public/data/", import.meta.url);
const roots = process.env.GITHUB_ACTIONS === "true"
  ? [pagesRoot]
  : [pagesRoot, new URL("../public/data/", import.meta.url)];
await Promise.all(roots.map((x) => mkdir(x, { recursive: true })));

const payload = await fetchOfficialData(true);
const screening = phase1ScreeningBundle(payload);

await Promise.all(
  roots.map((x) =>
    writeFile(
      new URL("phase-1-screening.json", x),
      JSON.stringify(screening, null, 2) + "\n",
    ),
  ),
);

console.log(
  `Phase 1 screening generated: ${screening.results.length} candidates, common period ${screening.commonPeriod.start} to ${screening.commonPeriod.end || "n/a"}`,
);
