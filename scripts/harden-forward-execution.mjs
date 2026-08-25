import { readFile, writeFile } from "node:fs/promises";

const replaceOne=(text,from,to,label)=>{
  if(!text.includes(from)) throw new Error(`Missing integrity anchor: ${label}`);
  if(text.split(from).length!==2) throw new Error(`Non-unique integrity anchor: ${label}`);
  return text.replace(from,to);
};

let forward=await readFile("lib/forward.ts","utf8");
forward=replaceOne(forward,'} from "./engine.ts";\n','} from "./engine.ts";\nimport { earliestLegalExecutionDate } from "./execution-integrity.ts";\n',"forward import");
forward=replaceOne(forward,'export const FORWARD_BUILD_VERSION = "forward-1.0.0";','export const FORWARD_BUILD_VERSION = "forward-1.0.1";',"forward build");
forward=replaceOne(forward,'tradeReason: signal.reason, intendedExecutionDate: nextExecutionDate(day.date), execution, assetClose: assetBar.close,','tradeReason: signal.reason, intendedExecutionDate: isLatest ? earliestLegalExecutionDate(day.date, generatedAt) : nextExecutionDate(day.date), execution, assetClose: assetBar.close,',"forward legal execution");
await writeFile("lib/forward.ts",forward);

let phase5=await readFile("lib/phase5-forward.ts","utf8");
phase5=replaceOne(phase5,'import { metricSet, nextExecutionDate, signals, STRATEGIES, type Bar, type Dataset, type Metrics, type Signal, type StrategyConfig } from "./engine.ts";\n','import { metricSet, nextExecutionDate, signals, STRATEGIES, type Bar, type Dataset, type Metrics, type Signal, type StrategyConfig } from "./engine.ts";\nimport { earliestLegalExecutionDate } from "./execution-integrity.ts";\n',"phase5 import");
phase5=replaceOne(phase5,'export const PHASE5_BUILD = "phase5-forward-1.0.0";','export const PHASE5_BUILD = "phase5-forward-1.0.1";',"phase5 build");
phase5=replaceOne(phase5,'signal:targetExposure===actualExposure?"HOLD":targetExposure>actualExposure?"INCREASE":"REDUCE",tradeReason:sig.reason,intendedExecutionDate:nextExecutionDate(day.date),execution,','signal:targetExposure===actualExposure?"HOLD":targetExposure>actualExposure?"INCREASE":"REDUCE",tradeReason:sig.reason,intendedExecutionDate:isLatest?earliestLegalExecutionDate(day.date,generatedAt):nextExecutionDate(day.date),execution,',"phase5 legal execution");
await writeFile("lib/phase5-forward.ts",phase5);

let pkg=await readFile("package.json","utf8");
if(!pkg.includes("tests/execution-integrity.test.ts")){
  pkg=replaceOne(pkg,'tests/phase5-paper.test.ts\"','tests/phase5-paper.test.ts tests/execution-integrity.test.ts\"',"core test registry");
  await writeFile("package.json",pkg);
}
console.log("Forward execution availability guard applied");
