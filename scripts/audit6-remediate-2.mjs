import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8"),write=(p,s)=>fs.writeFileSync(p,s);
const replace=(p,from,to,label)=>{const s=read(p);if(!s.includes(from))throw Error(`Audit6-2 target missing ${p}: ${label}`);if(s.indexOf(from)!==s.lastIndexOf(from))throw Error(`Audit6-2 target ambiguous ${p}: ${label}`);write(p,s.replace(from,to));};

// A6-6: Daily must reject incomplete/non-session bars anywhere in the dataset,
// not only if they happen to be the trailing row.
replace(
  "scripts/generate-daily.ts",
  '  const keepCompleteBars=(ds:typeof trackADataset)=>{while(ds.days.length&&!dailyBarIsComplete(ds.days.at(-1)!.date,generatedAt))ds.days.pop();if(ds.days.length<201)throw Error("DATA-003: no sufficiently long completed NYSE daily-bar history is available; no Signal was generated")};',
  '  const keepCompleteBars=(ds:typeof trackADataset)=>{const complete=ds.days.filter(d=>dailyBarIsComplete(d.date,generatedAt));ds.days.splice(0,ds.days.length,...complete);if(ds.days.length<201)throw Error("DATA-003: no sufficiently long completed NYSE daily-bar history is available; no Signal was generated")};',
  "filter every Daily bar",
);

// A6-8: A nominal annual review date that falls on a weekend/holiday becomes
// actionable only after the first subsequent NYSE session has closed.
replace(
  "lib/market-calendar.ts",
  'export function nyseReviewBoundaryReached(reviewDate:string,now=new Date().toISOString()){\n  if(!isValidIsoMarketDate(reviewDate))return false;\n  const clock=nyClock(now);\n  if(clock.localDate>reviewDate)return true;\n  if(clock.localDate<reviewDate)return false;\n  return !isNyseSession(reviewDate)||clock.minutes>=CLOSE_MINUTES;\n}',
  'export function effectiveReviewSession(reviewDate:string){if(!isValidIsoMarketDate(reviewDate))return null;if(isNyseSession(reviewDate))return reviewDate;const d=new Date(`${reviewDate}T12:00:00Z`);let guard=0;do{d.setUTCDate(d.getUTCDate()+1);if(++guard>10)return null}while(!isNyseSession(d.toISOString().slice(0,10)));return d.toISOString().slice(0,10)}\nexport function nyseReviewBoundaryReached(reviewDate:string,now=new Date().toISOString()){\n  const effective=effectiveReviewSession(reviewDate);if(!effective)return false;\n  const clock=nyClock(now);\n  if(clock.localDate>effective)return true;\n  if(clock.localDate<effective)return false;\n  return clock.minutes>=CLOSE_MINUTES;\n}',
  "roll review date to next NYSE session",
);

// A6-7: Phase 5 data acquisition is per-symbol fault isolated. A failed
// challenger must not prevent healthy candidates/current P5 Production from
// advancing and being assessed with their own status.
replace(
  "lib/official-data.ts",
  'export async function fetchPhase5ForwardData() {\n  const [UPRO, SSO, QLD, SPY, QQQ, VIX] = await Promise.all([\n    fetchNasdaq("UPRO"),\n    fetchNasdaq("SSO"),\n    fetchNasdaq("QLD"),\n    fetchNasdaq("SPY"),\n    fetchNasdaq("QQQ"),\n    fetchVix(),\n  ]);\n  return {\n    source: "Nasdaq Historical + Cboe VIX History · Phase 5 Forward Gate",\n    retrievedAt: new Date().toISOString(),\n    series: { UPRO, SSO, QLD, SPY, QQQ, VIX },\n    warnings: [\n      "Phase 5 Forward Gate is isolated from the main Daily TQQQ workflow and legacy UPRO Track B.",\n      "Actual ETF OHLC only; synthetic leveraged history is not used.",\n      "No Phase 5 record may predate the frozen 2026-08-25 Forward start date.",\n    ],\n  };\n}',
  'export async function fetchPhase5ForwardData() {\n  const keys=["UPRO","SSO","QLD","SPY","QQQ","VIX"] as const;\n  const settled=await Promise.allSettled([fetchNasdaq("UPRO"),fetchNasdaq("SSO"),fetchNasdaq("QLD"),fetchNasdaq("SPY"),fetchNasdaq("QQQ"),fetchVix()]);\n  const series:Record<string,Bar[]>={},errors:Record<string,string[]>={};\n  for(let i=0;i<keys.length;i++){const r=settled[i],k=keys[i];if(r.status==="fulfilled")series[k]=r.value;else errors[k]=[r.reason instanceof Error?r.reason.message:String(r.reason)];}\n  return {\n    source: "Nasdaq Historical + Cboe VIX History · Phase 5 Forward Gate",\n    retrievedAt: new Date().toISOString(),\n    series,errors,\n    warnings: [\n      "Phase 5 Forward Gate is isolated from the main Daily TQQQ workflow and legacy UPRO Track B.",\n      "Actual ETF OHLC only; synthetic leveraged history is not used.",\n      "A failed Phase 5 challenger feed is isolated; healthy frozen systems continue independently and the failed system remains non-selectable.",\n      "No Phase 5 record may predate the frozen 2026-08-25 Forward start date.",\n    ],\n  };\n}',
  "per-symbol Phase5 fetch isolation",
);

replace(
  "lib/phase5-forward.ts",
  'export function updatePhase5Ledger(payload:Payload,input?:Phase5Ledger|null,generatedAt=new Date().toISOString()):Phase5Ledger{\n  const ledger=input?.schemaVersion===1?structuredClone(input):emptyPhase5Ledger(generatedAt);\n  // Never mutate an existing freeze definition after Forward has started.\n  for(const frozen of PHASE5_FREEZES){const existing=ledger.freezes.find(x=>x.version===frozen.version);if(!existing)throw new Error(`Phase 5 freeze missing: ${frozen.version}`);if(JSON.stringify(existing)!==JSON.stringify(frozen))throw new Error(`Phase 5 freeze drift blocked: ${frozen.version}`)}\n  for(const freeze of ledger.freezes)appendFreeze(datasetFor(payload,freeze),ledger,freeze,payload.source||"official",generatedAt);\n  if(ledger.records.some(r=>r.marketDataDate<PHASE5_FORWARD_START))throw new Error("Phase 5 ledger contains pre-start record");\n  ledger.records.sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)||a.strategyVersion.localeCompare(b.strategyVersion));ledger.updatedAt=generatedAt;return ledger;\n}',
  'function assertPhase5FreezeIntegrity(ledger:Phase5Ledger){for(const frozen of PHASE5_FREEZES){const existing=ledger.freezes.find(x=>x.version===frozen.version);if(!existing)throw new Error(`Phase 5 freeze missing: ${frozen.version}`);if(JSON.stringify(existing)!==JSON.stringify(frozen))throw new Error(`Phase 5 freeze drift blocked: ${frozen.version}`)}if(ledger.freezes.length!==PHASE5_FREEZES.length)throw new Error("Phase 5 unexpected freeze definition")};\nexport function updatePhase5LedgerSubset(payload:Payload,input:Phase5Ledger|null|undefined,versions:string[],generatedAt=new Date().toISOString()):Phase5Ledger{\n  const ledger=input?.schemaVersion===1?structuredClone(input):emptyPhase5Ledger(generatedAt);assertPhase5FreezeIntegrity(ledger);const wanted=new Set(versions);\n  for(const version of wanted)if(!PHASE5_FREEZES.some(f=>f.version===version))throw new Error(`Phase 5 unknown frozen version: ${version}`);\n  for(const freeze of ledger.freezes.filter(f=>wanted.has(f.version)))appendFreeze(datasetFor(payload,freeze),ledger,freeze,payload.source||"official",generatedAt);\n  if(ledger.records.some(r=>r.marketDataDate<PHASE5_FORWARD_START))throw new Error("Phase 5 ledger contains pre-start record");\n  ledger.records.sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)||a.strategyVersion.localeCompare(b.strategyVersion));ledger.updatedAt=generatedAt;return ledger;\n}\nexport function updatePhase5Ledger(payload:Payload,input?:Phase5Ledger|null,generatedAt=new Date().toISOString()):Phase5Ledger{return updatePhase5LedgerSubset(payload,input,PHASE5_FREEZES.map(f=>f.version),generatedAt)}',
  "Phase5 subset ledger updater",
);

// This file is intentionally replaced after Audit6 remediation 1 has installed
// the shared completed-bar helper import.
write("scripts/generate-phase5-forward.ts",`import { mkdir, readFile, writeFile } from "node:fs/promises";\nimport { fetchPhase5ForwardData } from "../lib/official-data.ts";\nimport { emptyPhase5Ledger, PHASE5_FREEZES, summarizePhase5, updatePhase5LedgerSubset, type Phase5Ledger } from "../lib/phase5-forward.ts";\nimport {dailyBarIsComplete} from "../lib/market-calendar.ts";\n\nconst root=new URL("../github-pages/public/data/",import.meta.url);await mkdir(root,{recursive:true});\nconst generatedAt=new Date().toISOString();\nlet prior:Phase5Ledger;try{prior=JSON.parse(await readFile(new URL("phase-5-forward-ledger.json",root),"utf8"))}catch{prior=emptyPhase5Ledger(generatedAt)}\nconst keepCompletedNyseBars=<T extends {date:string}>(rows:T[],now:string)=>rows.filter(r=>dailyBarIsComplete(r.date,now));\n\ntry{\n  const payload=await fetchPhase5ForwardData();\n  const safe={...payload,series:Object.fromEntries(Object.entries(payload.series).map(([k,v])=>[k,keepCompletedNyseBars(v,generatedAt)]))};\n  let ledger=prior;const systems:Record<string,{status:"success"|"failed";latestDate:string|null;errors:string[]}>= {};\n  for(const freeze of PHASE5_FREEZES){\n    const required=[...new Set([freeze.ticker,freeze.proxy,"SPY","VIX"])],missing=required.filter(k=>!safe.series[k]?.length),feedErrors=required.flatMap(k=>payload.errors?.[k]??[]);\n    if(missing.length){systems[freeze.version]={status:"failed",latestDate:ledger.records.filter(r=>r.strategyVersion===freeze.version&&r.dataStatus==="VALID").at(-1)?.marketDataDate??null,errors:[...feedErrors,...missing.filter(k=>!(payload.errors?.[k]?.length)).map(k=>\`missing completed series: \${k}\`)]};continue}\n    try{ledger=updatePhase5LedgerSubset(safe,ledger,[freeze.version],generatedAt);systems[freeze.version]={status:"success",latestDate:ledger.records.filter(r=>r.strategyVersion===freeze.version&&r.dataStatus==="VALID").sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)).at(-1)?.marketDataDate??null,errors:[]}}\n    catch(error){systems[freeze.version]={status:"failed",latestDate:ledger.records.filter(r=>r.strategyVersion===freeze.version&&r.dataStatus==="VALID").at(-1)?.marketDataDate??null,errors:[error instanceof Error?error.message:String(error)]}}\n  }\n  const summary=summarizePhase5(ledger),latestDates=Object.fromEntries(Object.entries(safe.series).map(([k,v])=>[k,v.at(-1)?.date??null])),failed=Object.entries(systems).filter(([,s])=>s.status==="failed"),status=failed.length===0?"success":failed.length===PHASE5_FREEZES.length?"failed":"partial",errors=failed.flatMap(([version,s])=>s.errors.map(e=>\`${'${version}'}: \${e}\`));\n  await Promise.all([writeFile(new URL("phase-5-forward-ledger.json",root),\`${'${JSON.stringify(ledger,null,2)}'}\\n\`),writeFile(new URL("phase-5-forward-status.json",root),\`${'${JSON.stringify({generatedAt,status,forwardStart:"2026-08-25",latestDates,systems,summary,records:ledger.records.length,buildVersion:process.env.GITHUB_SHA?.slice(0,12)||"phase5-forward-1.0.0",errors},null,2)}'}\\n\`)]);\n  if(failed.length)throw new Error(\`Phase 5 partial/failed systems: \${failed.map(([v])=>v).join(", ")}\`);\n}catch(error){\n  let existing:any=null;try{existing=JSON.parse(await readFile(new URL("phase-5-forward-status.json",root),"utf8"))}catch{}\n  if(!existing?.generatedAt||existing.generatedAt!==generatedAt)await writeFile(new URL("phase-5-forward-status.json",root),\`${'${JSON.stringify({generatedAt,status:"failed",forwardStart:"2026-08-25",records:prior.records.length,summary:summarizePhase5(prior),buildVersion:process.env.GITHUB_SHA?.slice(0,12)||"phase5-forward-1.0.0",errors:[error instanceof Error?error.message:String(error)]},null,2)}'}\\n\`);\n  throw error;\n}\n`);

// Candidate-specific status: top-level partial is informational; current P5
// Production uses only the feeds required by its own frozen version.
replace(
  "lib/lifecycle-review.ts",
  'export type LifecycleInputStatus={status?:string;errors?:string[];generatedAt?:string;latestDates?:Record<string,string>};',
  'export type LifecycleInputStatus={status?:string;errors?:string[];generatedAt?:string;latestDates?:Record<string,string>;systems?:Record<string,{status?:string;latestDate?:string|null;errors?:string[]}>};',
  "per-system lifecycle status type",
);
replace(
  "lib/lifecycle-review.ts",
  'function phase5StatusQuality(status:LifecycleInputStatus|null|undefined,now:string,strictCurrent:boolean){\n  const commonDate=status?.latestDates?minDate(Object.values(status.latestDates)):undefined;\n  const lag=marketDataLagSessions(commonDate,now),fresh=Boolean(status?.status==="success"&&!(status?.errors?.length)&&upstreamWorkflowFresh(status?.generatedAt,now));\n  const dataCurrent=strictCurrent?lag===0:lag<=1;\n  return{ok:fresh&&dataCurrent,fresh,lag,commonDate,reasons:[...(!fresh?["Phase 5 workflow status is stale/failed"]:[]),...(!dataCurrent?[`Phase 5 common market data lags ${lag} completed NYSE session(s)`]:[])]};\n}',
  'function phase5StatusQuality(status:LifecycleInputStatus|null|undefined,now:string,strictCurrent:boolean,version?:string){\n  const system=version?status?.systems?.[version]:undefined,commonDate=system?.latestDate??(status?.latestDates?minDate(Object.values(status.latestDates)):undefined),systemStatus=system?.status??status?.status,errors=system?.errors??status?.errors;\n  const lag=marketDataLagSessions(commonDate||undefined,now),fresh=Boolean(systemStatus==="success"&&!(errors?.length)&&upstreamWorkflowFresh(status?.generatedAt,now));\n  const dataCurrent=strictCurrent?lag===0:lag<=1;\n  return{ok:fresh&&dataCurrent,fresh,lag,commonDate,reasons:[...(!fresh?[`Phase 5 ${version??"workflow"} status is stale/failed`]:[]),...(!dataCurrent?[`Phase 5 ${version??"common"} market data lags ${lag} completed NYSE session(s)`]:[])]};\n}',
  "version-specific phase5 quality",
);
replace(
  "lib/lifecycle-review.ts",
  '  const strict=stage==="FORMAL"||stage==="STRONGER",q=phase5StatusQuality(status,now,strict),labels=ledger.records.filter(r=>r.strategyVersion===summary.version&&r.dataStatus==="VALID").map(r=>r.regime);',
  '  const strict=stage==="FORMAL"||stage==="STRONGER",q=phase5StatusQuality(status,now,strict,summary.version),labels=ledger.records.filter(r=>r.strategyVersion===summary.version&&r.dataStatus==="VALID").map(r=>r.regime);',
  "review candidate specific status",
);
replace(
  "lib/lifecycle-review.ts",
  '  const quality=p5?phase5StatusQuality(phase5Status,now,false):legacyStatusQuality(runtimeStatus,forward,now,false),historicalDd=HIST_DD[version]??-.40;',
  '  const quality=p5?phase5StatusQuality(phase5Status,now,false,version):legacyStatusQuality(runtimeStatus,forward,now,false),historicalDd=HIST_DD[version]??-.40;',
  "Production health candidate specific status",
);

// Update stale old test to assert the stronger persistence/authority contract.
replace(
  "tests/re-audit2-phasee.test.ts",
  '  assert.match(phase5,/Enforce Phase 5 generation and build success[\\s\\S]*test "\\$\\{\\{ steps\\.generate\\.outcome \\}\\}" = "success"/);',
  '  assert.match(phase5,/Enforce Phase 5 generation, persistence, authority and build success[\\s\\S]*test "\\$\\{\\{ steps\\.generate\\.outcome \\}\\}" = "success"/);\n  assert.match(phase5,/id: persist/);assert.match(phase5,/id: authority/);\n  assert.match(phase5,/Build integrated PWA[\\s\\S]*steps\\.persist\\.outcome == \'success\'[\\s\\S]*steps\\.authority\\.outcome == \'success\'/);',
  "stronger Phase5 workflow contract test",
);

// Add P5 Production isolation test. First helper already appends recovery test.
replace(
  "tests/lifecycle-review.test.ts",
  'import { DEFAULT_PRODUCTION_CONFIG } from "../lib/production.ts";',
  'import { DEFAULT_PRODUCTION_CONFIG, transitionMode } from "../lib/production.ts";',
  "lifecycle test Production transition import",
);
let life=read("tests/lifecycle-review.test.ts");
life += `\n\ntest("failed unrelated Phase5 challenger does not poison healthy Phase5 Production",()=>{\n  const x=base();for(const f of x.phase5.freezes)seedPhase5(x.phase5,f.version,262,6);seedIncumbent(x.forward,262,6);\n  const d=transitionMode(DEFAULT_PRODUCTION_CONFIG,"DECISION"),p=transitionMode(d,"PRODUCTION",{ticker:"UPRO",system:"UPRO + S&P Broad Trend",version:"UPRO-SPBT-v1.0",date:"2027-08-25",evidence:"Strong",finalReviewComplete:true});x.production=p;\n  x.phase5Status={...x.phase5Status,status:"partial",systems:{"UPRO-SPBT-v1.0":{status:"success",latestDate:"2027-08-25",errors:[]},"SSO-SPBT-Scaled-v1.0":{status:"failed",latestDate:"2027-08-24",errors:["SSO feed failed"]},"QLD-VS13-Scaled-v1.0":{status:"success",latestDate:"2027-08-25",errors:[]}}};\n  const r=updateLifecycleReview({...x,prior:null});const incumbent=r.current.candidateReviews.find(c=>c.incumbent)!;\n  assert.equal(incumbent.version,"UPRO-SPBT-v1.0");assert.equal(incumbent.eligible,true);assert.ok(!incumbent.reasons.some(s=>s.includes("stale/failed")));assert.notEqual(r.current.productionHealth.state,"Critical");assert.notEqual(r.current.productionHealth.state,"Revalidation Required");\n});\n`;
write("tests/lifecycle-review.test.ts",life);

let a6=read("tests/audit6-recurring-failures.test.ts");
a6 += `\n\ntest("Daily filters every operational bar through the shared completed-session predicate",()=>{\n  const s=fs.readFileSync("scripts/generate-daily.ts","utf8");assert.match(s,/ds\\.days\\.filter\\(d=>dailyBarIsComplete\\(d\\.date,generatedAt\\)\\)/);assert.doesNotMatch(s,/while\\(ds\\.days\\.length&&!dailyBarIsComplete/);\n});\n\ntest("weekend or holiday review dates roll to the next NYSE close",async()=>{\n  const {nyseReviewBoundaryReached,effectiveReviewSession}=await import("../lib/market-calendar.ts");\n  assert.equal(effectiveReviewSession("2027-08-28"),"2027-08-30");assert.equal(nyseReviewBoundaryReached("2027-08-28","2027-08-28T22:00:00Z"),false);assert.equal(nyseReviewBoundaryReached("2027-08-28","2027-08-30T19:59:00Z"),false);assert.equal(nyseReviewBoundaryReached("2027-08-28","2027-08-30T20:01:00Z"),true);\n});\n\ntest("Phase5 acquisition and lifecycle isolate frozen systems by version",()=>{\n  const data=fs.readFileSync("lib/official-data.ts","utf8"),gen=fs.readFileSync("scripts/generate-phase5-forward.ts","utf8"),life=fs.readFileSync("lib/lifecycle-review.ts","utf8"),p5=fs.readFileSync("lib/phase5-forward.ts","utf8");\n  assert.match(data,/Promise\\.allSettled/);assert.match(gen,/systems:Record/);assert.match(gen,/updatePhase5LedgerSubset/);assert.match(p5,/export function updatePhase5LedgerSubset/);assert.match(life,/status\\?\\.systems\\?\\.\\[version\\]/);assert.match(life,/phase5StatusQuality\\(phase5Status,now,false,version\\)/);\n});\n`;
write("tests/audit6-recurring-failures.test.ts",a6);
console.log("Audit 6 remediation extension applied");
