import fs from "node:fs";

const patch=(path,from,to)=>{let s=fs.readFileSync(path,"utf8");if(s.includes(to))return;if(!s.includes(from))throw Error(`Audit 7 M07 patch guard failed: ${path}`);s=s.replace(from,to);fs.writeFileSync(path,s)};

patch("lib/forward.ts",'import {countNyseSessions} from "./market-calendar.ts";','import {countNyseSessions,isNyseSession} from "./market-calendar.ts";');
patch("lib/forward.ts",
`export function assertForwardLedgerInternalIntegrity(ledger:ForwardLedger){
  if(ledger.schemaVersion!==FORWARD_SCHEMA_VERSION||ledger.appendOnly!==true)throw Error("Forward prior ledger is invalid; refusing append-only reset");
  assertForwardFreezeIntegrity(ledger);
  const keys=new Set<string>(),logical=new Set<string>();
  for(const r of ledger.records){
    const freeze=ledger.freezes.find(f=>f.version===r.strategyVersion);if(!freeze)throw Error(\`Forward integrity: unknown strategy version \${r.strategyVersion}\`);
    const expected=keyOf(r.strategyVersion,r.marketDataDate);if(r.key!==expected)throw Error(\`Forward integrity: record key mismatch \${r.key}\`);
    if(r.marketDataDate<freeze.startDate)throw Error(\`Forward integrity: pre-start record \${r.key}\`);
    if(keys.has(r.key)||logical.has(expected))throw Error(\`Forward integrity: duplicate record \${r.key}\`);keys.add(r.key);logical.add(expected);
  }
}`,
`export function assertForwardLedgerInternalIntegrity(ledger:ForwardLedger){
  if(ledger.schemaVersion!==FORWARD_SCHEMA_VERSION||ledger.appendOnly!==true)throw Error("Forward prior ledger is invalid; refusing append-only reset");
  assertForwardFreezeIntegrity(ledger);
  const canonical=[...ledger.records].sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)||a.strategyVersion.localeCompare(b.strategyVersion));
  for(let i=0;i<ledger.records.length;i++)if(canonical[i]?.key!==ledger.records[i]?.key)throw Error(\`Forward integrity: non-canonical record order at index \${i}\`);
  const keys=new Set<string>(),logical=new Set<string>();
  for(const r of ledger.records){
    const freeze=ledger.freezes.find(f=>f.version===r.strategyVersion);if(!freeze)throw Error(\`Forward integrity: unknown strategy version \${r.strategyVersion}\`);
    if(!isNyseSession(r.marketDataDate))throw Error(\`Forward integrity: invalid/non-session market date \${r.marketDataDate}\`);
    if(!Number.isFinite(Date.parse(r.recordedAt)))throw Error(\`Forward integrity: invalid recordedAt \${r.key}\`);
    const expected=keyOf(r.strategyVersion,r.marketDataDate);if(r.key!==expected)throw Error(\`Forward integrity: record key mismatch \${r.key}\`);
    if(r.marketDataDate<freeze.startDate)throw Error(\`Forward integrity: pre-start record \${r.key}\`);
    if(keys.has(r.key)||logical.has(expected))throw Error(\`Forward integrity: duplicate record \${r.key}\`);keys.add(r.key);logical.add(expected);
  }
}`);

patch("lib/phase5-forward.ts",'import {countNyseSessions} from "./market-calendar.ts";','import {countNyseSessions,isNyseSession} from "./market-calendar.ts";');
patch("lib/phase5-forward.ts",
`export function assertPhase5LedgerInternalIntegrity(ledger:Phase5Ledger){
  if(ledger.schemaVersion!==1||ledger.appendOnly!==true)throw new Error("Phase 5 prior ledger is invalid; refusing append-only reset");assertPhase5FreezeIntegrity(ledger);
  const keys=new Set<string>(),logical=new Set<string>();for(const r of ledger.records){const freeze=ledger.freezes.find(f=>f.version===r.strategyVersion);if(!freeze)throw new Error(\`Phase 5 integrity: unknown version \${r.strategyVersion}\`);const expected=keyOf(r.strategyVersion,r.marketDataDate);if(r.key!==expected)throw new Error(\`Phase 5 integrity: record key mismatch \${r.key}\`);if(r.marketDataDate<freeze.startDate)throw new Error(\`Phase 5 integrity: pre-start record \${r.key}\`);if(keys.has(r.key)||logical.has(expected))throw new Error(\`Phase 5 integrity: duplicate record \${r.key}\`);keys.add(r.key);logical.add(expected);}
}`,
`export function assertPhase5LedgerInternalIntegrity(ledger:Phase5Ledger){
  if(ledger.schemaVersion!==1||ledger.appendOnly!==true)throw new Error("Phase 5 prior ledger is invalid; refusing append-only reset");assertPhase5FreezeIntegrity(ledger);
  const canonical=[...ledger.records].sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)||a.strategyVersion.localeCompare(b.strategyVersion));for(let i=0;i<ledger.records.length;i++)if(canonical[i]?.key!==ledger.records[i]?.key)throw new Error(\`Phase 5 integrity: non-canonical record order at index \${i}\`);
  const keys=new Set<string>(),logical=new Set<string>();for(const r of ledger.records){const freeze=ledger.freezes.find(f=>f.version===r.strategyVersion);if(!freeze)throw new Error(\`Phase 5 integrity: unknown version \${r.strategyVersion}\`);if(!isNyseSession(r.marketDataDate))throw new Error(\`Phase 5 integrity: invalid/non-session market date \${r.marketDataDate}\`);if(!Number.isFinite(Date.parse(r.recordedAt)))throw new Error(\`Phase 5 integrity: invalid recordedAt \${r.key}\`);const expected=keyOf(r.strategyVersion,r.marketDataDate);if(r.key!==expected)throw new Error(\`Phase 5 integrity: record key mismatch \${r.key}\`);if(r.marketDataDate<freeze.startDate)throw new Error(\`Phase 5 integrity: pre-start record \${r.key}\`);if(keys.has(r.key)||logical.has(expected))throw new Error(\`Phase 5 integrity: duplicate record \${r.key}\`);keys.add(r.key);logical.add(expected);}
}`);

patch("lib/lifecycle-review.ts",'import {marketDataLagSessions,marketDate,nyseReviewBoundaryReached,upstreamWorkflowFresh} from "./market-calendar.ts";','import {isValidIsoMarketDate,marketDataLagSessions,marketDate,nyseReviewBoundaryReached,upstreamWorkflowFresh} from "./market-calendar.ts";');
patch("lib/lifecycle-review.ts",
`export function assertLifecycleLedgerInternalIntegrity(ledger:LifecycleLedger){
  if(ledger.schemaVersion!==1||ledger.appendOnly!==true)throw Error("Lifecycle prior ledger is invalid; refusing append-only reset");const keys=new Set<string>();for(const e of ledger.events){if(!e.key||keys.has(e.key))throw Error(\`Lifecycle integrity: duplicate/invalid event key \${e.key}\`);if(!DATE_RE.test(e.reviewDate)||!Number.isFinite(Date.parse(e.recordedAt)))throw Error(\`Lifecycle integrity: invalid event chronology \${e.key}\`);keys.add(e.key);}
}`,
`export function assertLifecycleLedgerInternalIntegrity(ledger:LifecycleLedger){
  if(ledger.schemaVersion!==1||ledger.appendOnly!==true)throw Error("Lifecycle prior ledger is invalid; refusing append-only reset");const keys=new Set<string>();let previousRecordedAt=-Infinity;for(const e of ledger.events){if(!e.key||keys.has(e.key))throw Error(\`Lifecycle integrity: duplicate/invalid event key \${e.key}\`);if(!isValidIsoMarketDate(e.reviewDate)||!Number.isFinite(Date.parse(e.recordedAt)))throw Error(\`Lifecycle integrity: invalid event chronology \${e.key}\`);const recordedAt=Date.parse(e.recordedAt);if(recordedAt<previousRecordedAt)throw Error(\`Lifecycle integrity: out-of-order event chronology \${e.key}\`);previousRecordedAt=recordedAt;keys.add(e.key);}
}`);

patch("lib/production-health-review.ts",'import {marketDate,nyseReviewBoundaryReached} from "./market-calendar.ts";','import {isValidIsoMarketDate,marketDate,nyseReviewBoundaryReached} from "./market-calendar.ts";');
patch("lib/production-health-review.ts",
`export function assertProductionHealthLedgerInternalIntegrity(ledger:ProductionHealthLedger){
  if(ledger.schemaVersion!==1||ledger.appendOnly!==true)throw Error("Production Health prior ledger is invalid; refusing append-only reset");const keys=new Set<string>(),logical=new Set<string>();for(const e of ledger.events){const id=\`\${e.version}|\${e.dueDate}\`;if(!e.key||e.key!==id||keys.has(e.key)||logical.has(id))throw Error(\`Production Health integrity: duplicate/invalid event \${e.key}\`);if(!Number.isFinite(Date.parse(e.recordedAt)))throw Error(\`Production Health integrity: invalid recordedAt \${e.key}\`);keys.add(e.key);logical.add(id);}
}`,
`export function assertProductionHealthLedgerInternalIntegrity(ledger:ProductionHealthLedger){
  if(ledger.schemaVersion!==1||ledger.appendOnly!==true)throw Error("Production Health prior ledger is invalid; refusing append-only reset");const keys=new Set<string>(),logical=new Set<string>();let previousRecordedAt=-Infinity;for(const e of ledger.events){const id=\`\${e.version}|\${e.dueDate}\`;if(!e.key||e.key!==id||keys.has(e.key)||logical.has(id))throw Error(\`Production Health integrity: duplicate/invalid event \${e.key}\`);if(!isValidIsoMarketDate(e.dueDate)||!Number.isFinite(Date.parse(e.recordedAt)))throw Error(\`Production Health integrity: invalid event date/timestamp \${e.key}\`);const recordedAt=Date.parse(e.recordedAt);if(recordedAt<previousRecordedAt)throw Error(\`Production Health integrity: out-of-order event chronology \${e.key}\`);previousRecordedAt=recordedAt;keys.add(e.key);logical.add(id);}
}`);
