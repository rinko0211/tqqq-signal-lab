import fs from "node:fs";
const read=p=>fs.readFileSync(p,"utf8"),write=(p,s)=>fs.writeFileSync(p,s);
const replace=(p,from,to,label)=>{const s=read(p);if(!s.includes(from))throw Error(`Audit6-3 target missing ${p}: ${label}`);if(s.indexOf(from)!==s.lastIndexOf(from))throw Error(`Audit6-3 target ambiguous ${p}: ${label}`);write(p,s.replace(from,to));};

// A6-9/A6-10: runtime authority and append-only state must never silently reset.
replace("lib/forward.ts",
'  const ledger = input?.schemaVersion === FORWARD_SCHEMA_VERSION ? structuredClone(input) : emptyForwardLedger(generatedAt);',
'  if(input&&(input.schemaVersion!==FORWARD_SCHEMA_VERSION||input.appendOnly!==true))throw Error("Forward prior ledger is invalid; refusing append-only reset");\n  const ledger = input ? structuredClone(input) : emptyForwardLedger(generatedAt);',
"Forward invalid-prior fail closed");

replace("lib/phase5-forward.ts",
'  const ledger=input?.schemaVersion===1?structuredClone(input):emptyPhase5Ledger(generatedAt);assertPhase5FreezeIntegrity(ledger);const wanted=new Set(versions);',
'  if(input&&(input.schemaVersion!==1||input.appendOnly!==true))throw new Error("Phase 5 prior ledger is invalid; refusing append-only reset");\n  const ledger=input?structuredClone(input):emptyPhase5Ledger(generatedAt);assertPhase5FreezeIntegrity(ledger);const wanted=new Set(versions);',
"Phase5 invalid-prior fail closed");

replace("lib/lifecycle-review.ts",
'  const now=args.now??new Date().toISOString(),asOf=marketDate(now);if(!DATE_RE.test(asOf))throw Error("Invalid lifecycle review date");\n  const schedule=',
'  const now=args.now??new Date().toISOString(),asOf=marketDate(now);if(!DATE_RE.test(asOf))throw Error("Invalid lifecycle review date");\n  if(args.prior&&(args.prior.schemaVersion!==1||args.prior.appendOnly!==true))throw Error("Lifecycle prior ledger is invalid; refusing append-only reset");\n  const schedule=',
"Lifecycle invalid-prior fail closed");

replace("lib/production-health-review.ts",
'  const now=args.now??new Date().toISOString(),asOf=marketDate(now),out=args.prior?.schemaVersion===1?structuredClone(args.prior):emptyProductionHealthLedger(now),p=args.production;',
'  const now=args.now??new Date().toISOString(),asOf=marketDate(now);if(args.prior&&(args.prior.schemaVersion!==1||args.prior.appendOnly!==true))throw Error("Production Health prior ledger is invalid; refusing append-only reset");const out=args.prior?structuredClone(args.prior):emptyProductionHealthLedger(now),p=args.production;',
"Health invalid-prior fail closed");

// Production authority gets an explicit runtime structural validator.
replace("lib/production.ts",
'export const DEFAULT_PRODUCTION_CONFIG:ProductionConfig={schemaVersion:1,mode:"RESEARCH",selectedTicker:null,selectedStrategy:null,strategyVersion:null,approvedByHuman:false,approvalDate:null,effectiveDate:null,lastHealthReview:null,nextHealthReview:null,updatedAt:"2026-08-24T00:00:00.000Z"};\nexport function hasActiveProduction',
'export const DEFAULT_PRODUCTION_CONFIG:ProductionConfig={schemaVersion:1,mode:"RESEARCH",selectedTicker:null,selectedStrategy:null,strategyVersion:null,approvedByHuman:false,approvalDate:null,effectiveDate:null,lastHealthReview:null,nextHealthReview:null,updatedAt:"2026-08-24T00:00:00.000Z"};\nexport function assertProductionConfigIntegrity(value:unknown):asserts value is ProductionConfig{\n  if(!value||typeof value!=="object")throw Error("CONFIG-003: Production config is missing or malformed");const p=value as Partial<ProductionConfig>;\n  if(p.schemaVersion!==1||!["RESEARCH","DECISION","PRODUCTION"].includes(p.mode||""))throw Error("CONFIG-003: Production config schema/mode is invalid");\n  const selected=Boolean(p.selectedTicker&&p.selectedStrategy&&p.strategyVersion);\n  if(p.mode==="RESEARCH"&&(p.approvedByHuman||selected))throw Error("CONFIG-004: RESEARCH cannot carry approved Production authority");\n  if(p.mode==="PRODUCTION"&&(!p.approvedByHuman||!selected))throw Error("CONFIG-005: PRODUCTION requires complete human-approved authority");\n  if(p.approvedByHuman){if(!selected||!p.approvalDate||!p.effectiveDate)throw Error("CONFIG-006: approved authority is incomplete");resolveProductionSystem(p.selectedTicker!,p.strategyVersion!,p.selectedStrategy)}else if(selected)throw Error("CONFIG-007: unapproved config cannot select a Production system");\n}\nexport function productionConfigIsValid(value:unknown){try{assertProductionConfigIntegrity(value);return true}catch{return false}}\nexport function hasActiveProduction',
"Production authority validator");

// Daily generator: every current authority/state file is required now that the system is live.
replace("scripts/generate-daily.ts",
'import { emptyForwardLedger, summarizeForward, updateForwardLedger, type ForwardLedger } from "../lib/forward.ts";',
'import { summarizeForward, updateForwardLedger, type ForwardLedger } from "../lib/forward.ts";',
"Daily remove empty Forward fallback import");
replace("scripts/generate-daily.ts",
'import {DEFAULT_PRODUCTION_CONFIG,hasActiveProduction,resolveProductionSystem,type ProductionConfig} from "../lib/production.ts";',
'import {assertProductionConfigIntegrity,hasActiveProduction,resolveProductionSystem,type ProductionConfig} from "../lib/production.ts";',
"Daily Production validator import");
replace("scripts/generate-daily.ts",
'const readJson = async <T>(name: string, fallback: T) => { try { return JSON.parse(await readFile(new URL(name, root), "utf8")) as T; } catch { return fallback; } };',
'const readRequiredJson=async<T>(name:string):Promise<T>=>{try{return JSON.parse(await readFile(new URL(name,root),"utf8")) as T}catch(error){throw Error(`STATE-001: required ${name} is missing/corrupt; refusing operational state reset (${error instanceof Error?error.message:String(error)})`)}};',
"Daily strict state reader");
replace("scripts/generate-daily.ts",
'const priorSignal = await readJson<{dataDate?:string;assetTicker?:string;strategyVersion?:string}|null>("signal.json", null);\nconst history = await readJson<LiveSnapshot[]>("live-history.json", []);\nconst priorForward = await readJson<ForwardLedger>("forward-ledger.json", emptyForwardLedger(generatedAt));\nconst production = await readJson<ProductionConfig>("production-config.json", DEFAULT_PRODUCTION_CONFIG);',
'const priorSignal=await readRequiredJson<{dataDate?:string;assetTicker?:string;strategyVersion?:string}>("signal.json");\nconst history=await readRequiredJson<LiveSnapshot[]>("live-history.json");\nconst priorForward=await readRequiredJson<ForwardLedger>("forward-ledger.json");\nconst production=await readRequiredJson<ProductionConfig>("production-config.json");\nif(priorForward.schemaVersion!==1||priorForward.appendOnly!==true)throw Error("STATE-002: Forward ledger authority is invalid");if(!Array.isArray(history))throw Error("STATE-003: live history is invalid");assertProductionConfigIntegrity(production);',
"Daily required authority files");

// Phase5 generator: its authoritative ledger is required and lint-clean.
replace("scripts/generate-phase5-forward.ts",
'import { emptyPhase5Ledger, PHASE5_FREEZES, summarizePhase5, updatePhase5LedgerSubset, type Phase5Ledger } from "../lib/phase5-forward.ts";',
'import { PHASE5_FREEZES, summarizePhase5, updatePhase5LedgerSubset, type Phase5Ledger } from "../lib/phase5-forward.ts";',
"Phase5 remove empty fallback import");
replace("scripts/generate-phase5-forward.ts",
'let prior:Phase5Ledger;try{prior=JSON.parse(await readFile(new URL("phase-5-forward-ledger.json",root),"utf8"))}catch{prior=emptyPhase5Ledger(generatedAt)}',
'let prior:Phase5Ledger;try{prior=JSON.parse(await readFile(new URL("phase-5-forward-ledger.json",root),"utf8")) as Phase5Ledger}catch(error){throw Error(`STATE-004: phase-5-forward-ledger.json missing/corrupt; refusing append-only reset (${error instanceof Error?error.message:String(error)})`)}if(prior.schemaVersion!==1||prior.appendOnly!==true)throw Error("STATE-005: Phase 5 ledger authority is invalid")',
"Phase5 strict prior ledger");
replace("scripts/generate-phase5-forward.ts",
'  let existing:any=null;try{existing=JSON.parse(await readFile(new URL("phase-5-forward-status.json",root),"utf8"))}catch{}',
'  let existing:{generatedAt?:string}|null=null;try{existing=JSON.parse(await readFile(new URL("phase-5-forward-status.json",root),"utf8")) as {generatedAt?:string}}catch{}',
"Phase5 lint-safe status type");

// Lifecycle generator: ledgers/config are authority, statuses may be absent only to fail quality closed.
write("scripts/generate-lifecycle-review.ts",`import { mkdir, readFile, writeFile } from "node:fs/promises";\nimport { type ForwardLedger } from "../lib/forward.ts";\nimport { type Phase5Ledger } from "../lib/phase5-forward.ts";\nimport { assertProductionConfigIntegrity, type ProductionConfig } from "../lib/production.ts";\nimport { updateLifecycleReview, type LifecycleInputStatus, type LifecycleLedger, type RuntimeStatus } from "../lib/lifecycle-review.ts";\nconst root=new URL("../github-pages/public/data/",import.meta.url);await mkdir(root,{recursive:true});\nconst required=async<T>(name:string):Promise<T>=>{try{return JSON.parse(await readFile(new URL(name,root),"utf8")) as T}catch(error){throw Error(\`STATE-006: required \${name} is missing/corrupt; refusing lifecycle reset (\${error instanceof Error?error.message:String(error)})\`)}};\nconst optional=async<T>(name:string,fallback:T):Promise<T>=>{try{return JSON.parse(await readFile(new URL(name,root),"utf8")) as T}catch{return fallback}};\nconst phase5=await required<Phase5Ledger>("phase-5-forward-ledger.json"),forward=await required<ForwardLedger>("forward-ledger.json"),production=await required<ProductionConfig>("production-config.json"),prior=await required<LifecycleLedger>("lifecycle-review.json");\nif(phase5.schemaVersion!==1||phase5.appendOnly!==true||forward.schemaVersion!==1||forward.appendOnly!==true||prior.schemaVersion!==1||prior.appendOnly!==true)throw Error("STATE-007: lifecycle authority ledger integrity failed");assertProductionConfigIntegrity(production);\nconst phase5Status=await optional<LifecycleInputStatus|null>("phase-5-forward-status.json",null),runtimeStatus=await optional<RuntimeStatus|null>("status.json",null),now=new Date().toISOString();\nconst ledger=updateLifecycleReview({phase5,forward,production,phase5Status,runtimeStatus,prior,now});await writeFile(new URL("lifecycle-review.json",root),JSON.stringify(ledger,null,2)+"\\n");console.log(\`${'${ledger.current.stage}'}: ${'${ledger.current.systemDecision}'} / ${'${ledger.current.userAction}'}\`);\n`);

// Production Health generator: no default Production and no empty health-history fallback.
write("scripts/generate-production-health-review.ts",`import{readFile,writeFile}from"node:fs/promises";\nimport{assertProductionConfigIntegrity,type ProductionConfig}from"../lib/production.ts";\nimport{type LifecycleLedger}from"../lib/lifecycle-review.ts";\nimport{updateProductionHealthLedger,type ProductionHealthLedger}from"../lib/production-health-review.ts";\nconst root=new URL("../github-pages/public/data/",import.meta.url);const required=async<T>(n:string):Promise<T>=>{try{return JSON.parse(await readFile(new URL(n,root),"utf8")) as T}catch(error){throw Error(\`STATE-008: required \${n} is missing/corrupt; refusing health reset (\${error instanceof Error?error.message:String(error)})\`)}};\nconst production=await required<ProductionConfig>("production-config.json"),lifecycle=await required<LifecycleLedger>("lifecycle-review.json"),prior=await required<ProductionHealthLedger>("production-health-review.json");assertProductionConfigIntegrity(production);if(lifecycle.schemaVersion!==1||lifecycle.appendOnly!==true||prior.schemaVersion!==1||prior.appendOnly!==true)throw Error("STATE-009: Production Health authority ledger integrity failed");const next=updateProductionHealthLedger({production,lifecycle,prior,now:new Date().toISOString()});await writeFile(new URL("production-health-review.json",root),JSON.stringify(next,null,2)+"\\n");console.log(\`${'${next.current.state}'} / next ${'${next.current.nextReview||"n/a"}'}\`);\n`);

// Human approval must not bootstrap from a missing/corrupt authority file.
replace("scripts/approve-production.ts",
'import{DEFAULT_PRODUCTION_CONFIG,cancelDecision,hasActiveProduction,transitionMode,type ProductionConfig}from"../lib/production.ts";',
'import{assertProductionConfigIntegrity,cancelDecision,hasActiveProduction,transitionMode,type ProductionConfig}from"../lib/production.ts";',
"Approval validator import");
replace("scripts/approve-production.ts",
'const root=new URL("../github-pages/public/data/",import.meta.url),path=new URL("production-config.json",root);let current:ProductionConfig=DEFAULT_PRODUCTION_CONFIG;\ntry{current=JSON.parse(await readFile(path,"utf8"))}catch{}\nlet next:ProductionConfig;',
'const root=new URL("../github-pages/public/data/",import.meta.url),path=new URL("production-config.json",root);let current:ProductionConfig;\ntry{current=JSON.parse(await readFile(path,"utf8")) as ProductionConfig}catch(error){throw Error(`STATE-010: production-config.json missing/corrupt; refusing authority bootstrap (${error instanceof Error?error.message:String(error)})`)}assertProductionConfigIntegrity(current);\nlet next:ProductionConfig;',
"Approval strict authority read");

// A6-11: the primary action may trade only a current signal change before its legal open.
replace("app/page.tsx",
'import {HEALTH_POLICY,DEGRADATION_RULES,PRODUCTION_SYSTEMS,type ProductionConfig} from "../lib/production";',
'import {HEALTH_POLICY,DEGRADATION_RULES,PRODUCTION_SYSTEMS,productionConfigIsValid,type ProductionConfig} from "../lib/production";',
"UI Production authority validator");
replace("app/page.tsx",
'    executionMissed=Boolean(signal&&Math.abs(signal.target-signal.previousTarget)>=.001&&executionWindow==="OPEN_PASSED"),\n    signalUnsafe=Boolean(runtimeStatus?.state==="failed"||fresh?.stale),',
'    signalChange=Boolean(signal&&Math.abs(signal.target-signal.previousTarget)>=.001),\n    executionMissed=Boolean(signalChange&&executionWindow==="OPEN_PASSED"),\n    executionActionable=Boolean(signalChange&&executionWindow==="UPCOMING_OPEN"),\n    authorityUnsafe=Boolean(!dailySignal||!runtimeStatus||!productionConfigIsValid(productionConfig)||!forwardLedger),\n    signalUnsafe=Boolean(authorityUnsafe||runtimeStatus?.state==="failed"||fresh?.stale),',
"UI explicit actionable window");
replace("app/page.tsx",
'            : actual === null\n              ? "保有状況未入力：目標のみ表示"\n              : Math.abs(actual - target) < 0.001\n                ? "変更なし"\n                : actual < target\n                  ? `${currentTicker}比率を${target * 100}%まで増加`\n                  : `${currentTicker}比率を${target * 100}%まで縮小`;',
'            : actual === null\n              ? "保有状況未入力：目標のみ表示"\n              : !signalChange\n                ? "変更なし：現在Signalに新規売買指示はありません"\n                : !executionActionable\n                  ? "売買しない：有効な次回始値の実行ウィンドウを確認できません。次のDaily Signal更新後に再確認してください"\n                  : Math.abs(actual - target) < 0.001\n                    ? "変更なし"\n                    : actual < target\n                      ? `${currentTicker}比率を${target * 100}%まで増加`\n                      : `${currentTicker}比率を${target * 100}%まで縮小`;',
"UI no retrospective holdings chase");
replace("app/page.tsx",
'    ]).then((results)=>{\n      if(results[0].status==="rejected")setMessage("最新Signalを取得できません。System Statusを確認してください。");\n      setLoading(false);\n    });',
'    ]).then((results)=>{\n      if([0,1,3,4].some(i=>results[i]?.status==="rejected"))setMessage("運用authorityを確認できません。売買せずSystem Statusを確認してください。");\n      else if(results[0].status==="rejected")setMessage("最新Signalを取得できません。System Statusを確認してください。");\n      setLoading(false);\n    });',
"UI authority load failure banner");

// Permanent regression: source boundary + library invalid-prior behavior.
write("tests/audit6-final-failclosed.test.mjs",`import test from "node:test";\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\nimport {demoDataset} from "../lib/engine.ts";\nimport {emptyForwardLedger,updateForwardLedger} from "../lib/forward.ts";\nimport {emptyPhase5Ledger,updatePhase5LedgerSubset} from "../lib/phase5-forward.ts";\nimport {DEFAULT_PRODUCTION_CONFIG,assertProductionConfigIntegrity} from "../lib/production.ts";\nimport {emptyLifecycleLedger,updateLifecycleReview} from "../lib/lifecycle-review.ts";\nimport {emptyProductionHealthLedger,updateProductionHealthLedger} from "../lib/production-health-review.ts";\nconst r=p=>fs.readFileSync(p,"utf8");\n\ntest("operational authority files cannot silently bootstrap empty/default state",()=>{\n const d=r("scripts/generate-daily.ts"),p5=r("scripts/generate-phase5-forward.ts"),l=r("scripts/generate-lifecycle-review.ts"),h=r("scripts/generate-production-health-review.ts"),a=r("scripts/approve-production.ts");\n assert.match(d,/readRequiredJson/);assert.doesNotMatch(d,/emptyForwardLedger|DEFAULT_PRODUCTION_CONFIG/);\n assert.match(p5,/STATE-004/);assert.doesNotMatch(p5,/prior=emptyPhase5Ledger/);\n assert.match(l,/STATE-006/);assert.doesNotMatch(l,/emptyForwardLedger|emptyPhase5Ledger|emptyLifecycleLedger|DEFAULT_PRODUCTION_CONFIG/);\n assert.match(h,/STATE-008/);assert.doesNotMatch(h,/emptyProductionHealthLedger|DEFAULT_PRODUCTION_CONFIG/);\n assert.match(a,/STATE-010/);assert.doesNotMatch(a,/DEFAULT_PRODUCTION_CONFIG/);\n});\n\ntest("invalid supplied append-only prior ledgers are rejected at library boundaries",()=>{\n const f={...emptyForwardLedger(),schemaVersion:999};assert.throws(()=>updateForwardLedger(demoDataset(),f,"test"),/invalid/);\n const p={...emptyPhase5Ledger(),schemaVersion:999};assert.throws(()=>updatePhase5LedgerSubset({series:{}},p,[],"2026-08-27T00:00:00Z"),/invalid/);\n const ph={...emptyProductionHealthLedger(),schemaVersion:999};assert.throws(()=>updateProductionHealthLedger({production:DEFAULT_PRODUCTION_CONFIG,lifecycle:{},prior:ph}),/invalid/);\n const base5=emptyPhase5Ledger(),schedule={interim:base5.reviewSchedule.interim,formal:base5.reviewSchedule.formal,stronger:base5.reviewSchedule.stronger},badLife={...emptyLifecycleLedger(schedule),schemaVersion:999};assert.throws(()=>updateLifecycleReview({phase5:base5,forward:emptyForwardLedger(),production:DEFAULT_PRODUCTION_CONFIG,prior:badLife}),/invalid/);\n});\n\ntest("Production config validator rejects malformed or contradictory authority",()=>{\n assert.doesNotThrow(()=>assertProductionConfigIntegrity(DEFAULT_PRODUCTION_CONFIG));\n assert.throws(()=>assertProductionConfigIntegrity({...DEFAULT_PRODUCTION_CONFIG,mode:"PRODUCTION"}),/CONFIG-005/);\n assert.throws(()=>assertProductionConfigIntegrity({...DEFAULT_PRODUCTION_CONFIG,selectedTicker:"TQQQ",selectedStrategy:"Volatility Shield 13%",strategyVersion:"VS13-v1.0"}),/CONFIG-007/);\n});\n\ntest("primary action requires authority plus a new signal change before its legal open",()=>{\n const ui=r("app/page.tsx");assert.match(ui,/authorityUnsafe=Boolean\(!dailySignal\|\|!runtimeStatus\|\|!productionConfigIsValid\(productionConfig\)\|\|!forwardLedger\)/);assert.match(ui,/executionActionable=Boolean\(signalChange&&executionWindow==="UPCOMING_OPEN"\)/);assert.match(ui,/!signalChange[\\s\\S]*現在Signalに新規売買指示はありません/);assert.match(ui,/!executionActionable[\\s\\S]*有効な次回始値の実行ウィンドウ/);\n});\n`);

const pkg=JSON.parse(read("package.json"));for(const k of ["test:core","test:ops"]){if(!pkg.scripts[k].includes("tests/audit6-final-failclosed.test.mjs"))pkg.scripts[k]+=" tests/audit6-final-failclosed.test.mjs"}write("package.json",JSON.stringify(pkg,null,2)+"\n");
console.log("Audit 6 final fail-closed remediation applied");
