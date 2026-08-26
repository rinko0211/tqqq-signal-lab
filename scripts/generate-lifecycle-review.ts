import { mkdir, readFile, writeFile } from "node:fs/promises";
import { emptyForwardLedger, type ForwardLedger } from "../lib/forward.ts";
import { emptyPhase5Ledger, type Phase5Ledger } from "../lib/phase5-forward.ts";
import { DEFAULT_PRODUCTION_CONFIG, type ProductionConfig } from "../lib/production.ts";
import { emptyLifecycleLedger, updateLifecycleReview, type LifecycleInputStatus, type LifecycleLedger, type RuntimeStatus } from "../lib/lifecycle-review.ts";

const root=new URL("../github-pages/public/data/",import.meta.url);await mkdir(root,{recursive:true});
const read=async<T>(name:string,fallback:T):Promise<T>=>{try{return JSON.parse(await readFile(new URL(name,root),"utf8")) as T}catch{return fallback}};
const phase5=await read<Phase5Ledger>("phase-5-forward-ledger.json",emptyPhase5Ledger());
const forward=await read<ForwardLedger>("forward-ledger.json",emptyForwardLedger());
const production=await read<ProductionConfig>("production-config.json",DEFAULT_PRODUCTION_CONFIG);
const phase5Status=await read<LifecycleInputStatus|null>("phase-5-forward-status.json",null);
const runtimeStatus=await read<RuntimeStatus|null>("status.json",null);
const schedule={interim:phase5.reviewSchedule.interim,formal:phase5.reviewSchedule.formal,stronger:phase5.reviewSchedule.stronger};
const prior=await read<LifecycleLedger|null>("lifecycle-review.json",null);
const now=new Date().toISOString();
const ledger=updateLifecycleReview({phase5,forward,production,phase5Status,runtimeStatus,prior:prior??emptyLifecycleLedger(schedule,now),now});
await writeFile(new URL("lifecycle-review.json",root),JSON.stringify(ledger,null,2)+"\n");
console.log(`${ledger.current.stage}: ${ledger.current.systemDecision} / ${ledger.current.userAction}`);
