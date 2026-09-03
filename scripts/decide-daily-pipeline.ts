import { appendFile, readFile } from "node:fs/promises";
import { decideDailyPipeline } from "../lib/daily-retry.ts";

const signal = JSON.parse(
  await readFile(
    new URL("../github-pages/public/data/signal.json", import.meta.url),
    "utf8",
  ),
) as { dataDate?: string };

const decision = decideDailyPipeline({
  eventName: process.env.EVENT_NAME || "workflow_dispatch",
  deployPersistedOnly: process.env.DEPLOY_PERSISTED_ONLY === "true",
  marketDataDate: signal.dataDate,
});

const output = [
  `mode=${decision.mode}`,
  `run_pipeline=${decision.runPipeline}`,
  `fetch_data=${decision.fetchData}`,
  `availability=${decision.availability}`,
].join("\n");

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `${output}\n`);
}

console.log(
  `Daily pipeline decision: ${decision.mode} ` +
    `(persisted=${signal.dataDate || "missing"}, availability=${decision.availability})`,
);
