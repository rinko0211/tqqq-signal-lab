import {NextResponse} from "next/server";
import {STRATEGIES,datasetFromPayload,holdoutForConfig,nextExecutionDate,oosComparison,runBacktest,walkForward} from "../../../lib/engine";
import {fetchOfficialData} from "../../../lib/official-data";

export async function GET(){
  try{
    const payload=await fetchOfficialData();
    const dataset=datasetFromPayload(payload);
    const errors=dataset.issues.filter(issue=>issue.severity==="error");
    if(errors.length)throw new Error(errors.map(issue=>issue.message).join("; "));
    const config=STRATEGIES.defensive;
    const backtest=runBacktest(dataset,config);
    const latest=backtest.daily.at(-1)!;
    const walk=walkForward(dataset);
    const comparison=oosComparison(dataset);
    const holdout=holdoutForConfig(dataset,config);
    const validated=Boolean(holdout&&holdout.metrics.cagr>0&&holdout.metrics.maxDd>-.45&&holdout.metrics.sharpe>.5);
    return NextResponse.json({
      generatedAt:new Date().toISOString(),
      source:payload.source,
      dataDate:latest.date,
      tqqqClose:dataset.days.at(-1)!.tqqq.close,
      strategy:config.name,
      validationStatus:validated?"条件付き運用候補":"改良して再検証",
      signal:{regime:latest.signal.regime,score:latest.signal.score,components:latest.signal.components,target:latest.signal.target,previousTarget:latest.signal.previousTarget,reason:latest.signal.reason,nextChange:latest.signal.nextChange,executionDate:nextExecutionDate(latest.date)},
      suggestion:validated?`理論目標はTQQQ ${latest.signal.target*100}%。実保有比率との差分を確認し、翌営業日始値での調整を検討。最終判断はユーザーが行う。`:`検証基準未達のため新規売買を見送り、研究シグナルとして記録する。`,
      evidence:{pureOos:comparison.find(item=>item.key==="defensive")?.metrics,walkForward:walk.metrics,finalHoldout:holdout?.metrics||null},
      warnings:dataset.issues.filter(issue=>issue.severity==="warning").map(issue=>issue.message)
    },{headers:{"Cache-Control":"private, max-age=1800, stale-while-revalidate=3600"}});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"日次シグナル生成に失敗しました"},{status:502});
  }
}
