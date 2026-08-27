import fs from "node:fs";

const path="app/page.tsx";
let src=fs.readFileSync(path,"utf8");
const original=src;

const mustReplace=(from,to,label)=>{
  if(!src.includes(from))throw new Error(`Audit 8 instrumentation source contract missing: ${label}`);
  src=src.replace(from,to);
};

mustReplace("  nextExecutionDate,\n","","engine nextExecutionDate import");
mustReplace('import {nyseExecutionWindow} from "../lib/market-calendar";\nimport {operationalAuthorityBundleIsCoherent} from "../lib/operational-authority";\n','import {derivePrimaryAction} from "../lib/primary-action";\n',"primary action imports");

const start='    target = signal?.target ?? 0,';
const end='                      : `${currentTicker}比率を${target * 100}%まで縮小`;';
const a=src.indexOf(start),b=src.indexOf(end,a);
if(a<0||b<0)throw new Error("Audit 8 instrumentation action block markers not found");
const after=b+end.length;
const replacement=`    primaryAction=derivePrimaryAction({signal:dailySignal,status:runtimeStatus,forward:forwardLedger,production:productionConfig,now:now.toISOString(),holdings,freshnessDate:latestDate}),\n    target = primaryAction.target,\n    currentTicker=primaryAction.currentTicker,\n    currentVersion=primaryAction.currentVersion,\n    holdingsMatch=primaryAction.holdingsMatch,\n    displayHoldings=holdingsMatch?holdings:{...EMPTY,ticker:currentTicker,version:currentVersion},\n    actual = primaryAction.actual,\n    executionDate=primaryAction.executionDate,\n    executionWindow=primaryAction.executionWindow,\n    signalChange=primaryAction.signalChange,\n    executionMissed=primaryAction.executionMissed,\n    executionActionable=primaryAction.executionActionable,\n    authorityBundle=primaryAction.authorityBundle,\n    authorityUnsafe=primaryAction.authorityUnsafe,\n    signalUnsafe=primaryAction.signalUnsafe,\n    action = primaryAction.message;`;
src=src.slice(0,a)+replacement+src.slice(after);

if(src===original)throw new Error("Audit 8 instrumentation produced no diff");
if((src.match(/derivePrimaryAction\(/g)||[]).length!==1)throw new Error("Audit 8 instrumentation must wire exactly one primary action call");
fs.writeFileSync(path,src);
