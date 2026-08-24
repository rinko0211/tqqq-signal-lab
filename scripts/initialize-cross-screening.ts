import { mkdir, writeFile } from "node:fs/promises";
import { EXCLUDED, SCREENING, SCREENING_AS_OF, type CrossBundle } from "../lib/cross-ticker.ts";

const roots = [
  new URL("../github-pages/public/data/", import.meta.url),
  new URL("../public/data/", import.meta.url),
];
const bundle: CrossBundle = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  asOf: SCREENING_AS_OF,
  source: "Issuer official product pages; historical comparison pending weekly Action",
  actualSyntheticPolicy: "Actual ETF OHLC only. Synthetic leveraged returns are not used or mixed.",
  commonStart: null,
  screening: SCREENING,
  excluded: EXCLUDED,
  results: [],
  forwardCandidates: [],
  selectionRule: "Common VS13 framework; OOS return 25%, OOS Calmar 25%, OOS Sortino 15%, OOS DD 15%, Operational Quality 20%. ParetoかつOperational Quality>=80から最大3銘柄。自動Champion化は禁止。",
  limitations: [
    "Historical/OOS results are not shown until the bounded weekly Action completes successfully.",
    "SOXX is a liquid proxy for SOXL's NYSE Semiconductor Index and is not the exact index.",
    "Direxion accessible product pages did not expose fund-level AUM or median spread; missing fields remain missing.",
    "Candidate selection has survivorship/selection bias; excluded and failed products remain in the registry.",
  ],
};

await Promise.all(roots.flatMap(async root => {
  await mkdir(root, { recursive: true });
  return writeFile(new URL("cross-ticker.json", root), `${JSON.stringify(bundle, null, 2)}\n`);
}));
console.log(`Cross-ticker screening initialized: ${SCREENING.length} included, ${EXCLUDED.length} excluded`);
