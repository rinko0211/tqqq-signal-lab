import { mkdir, readFile, writeFile } from "node:fs/promises";
import { datasetFromPayload } from "../lib/engine.ts";
import { updateForwardLedger } from "../lib/forward.ts";
import { fetchUproForwardData } from "../lib/official-data.ts";
import { emptyTickerForwardLedger, TICKER_FORWARD_BUILD, UPRO_NATIVE_FREEZE, type TickerForwardLedger } from "../lib/ticker-forward.ts";

const root = new URL("../github-pages/public/data/", import.meta.url);
await mkdir(root, { recursive: true });
const generatedAt = new Date().toISOString();
let prior: TickerForwardLedger;
try { prior = JSON.parse(await readFile(new URL("ticker-forward-ledger.json", root), "utf8")); }
catch { prior = emptyTickerForwardLedger(generatedAt); }
if (!prior.freezes.some(x => x.version === "UPRO-VS13-v1.0")) prior = emptyTickerForwardLedger(generatedAt);
if (!prior.freezes.some(x=>x.version===UPRO_NATIVE_FREEZE.version)) prior.freezes.push(UPRO_NATIVE_FREEZE);

try {
  const payload = await fetchUproForwardData();
  const dataset = datasetFromPayload(payload);
  const errors = dataset.issues.filter(x => x.severity === "error");
  if (errors.length) throw Error(errors.map(x => x.message).join("; "));
  const ledger = updateForwardLedger(dataset, prior, payload.source, generatedAt) as TickerForwardLedger;
  ledger.track = "Track B";
  ledger.candidateTicker = "UPRO";
  ledger.selectionRule = prior.selectionRule;
  await Promise.all([
    writeFile(new URL("ticker-forward-ledger.json", root), `${JSON.stringify(ledger, null, 2)}\n`),
    writeFile(new URL("ticker-forward-status.json", root), `${JSON.stringify({generatedAt,status:"success",ticker:"UPRO",versions:ledger.freezes.map(x=>x.version),marketDataDate:ledger.records.at(-1)?.marketDataDate||null,records:ledger.records.length,dataSource:payload.source,buildVersion:process.env.GITHUB_SHA?.slice(0,12)||TICKER_FORWARD_BUILD,errors:[]},null,2)}\n`),
  ]);
} catch (error) {
  await writeFile(new URL("ticker-forward-status.json", root), `${JSON.stringify({generatedAt,status:"failed",ticker:"UPRO",version:"UPRO-VS13-v1.0",marketDataDate:prior.records.at(-1)?.marketDataDate||null,records:prior.records.length,dataSource:"unchanged",buildVersion:process.env.GITHUB_SHA?.slice(0,12)||TICKER_FORWARD_BUILD,errors:[error instanceof Error?error.message:String(error)]},null,2)}\n`);
  throw error;
}
