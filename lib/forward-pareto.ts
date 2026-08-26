import {metricSet,type Metrics} from "./engine.ts";
import type {ForwardLedger} from "./forward.ts";
import type {Phase5Ledger} from "./phase5-forward.ts";

export type ParetoMerit="NOT_EVALUATED"|"PARETO_SUPPORTED"|"MIXED"|"DOMINATED_BY_INCUMBENT";
export type CommonForwardMetrics={days:number;totalReturn:number;metrics:Metrics;actionDays:number};
export type ParetoComparison={version:string;incumbentVersion:string;commonDays:number;candidate:CommonForwardMetrics|null;incumbent:CommonForwardMetrics|null;merit:ParetoMerit;reasons:string[]};

function commonMetrics(rows:{marketDataDate:string;dailyReturn:number;position:number;execution?:unknown}[],dates:Set<string>):CommonForwardMetrics|null{
  const x=rows.filter(r=>dates.has(r.marketDataDate)).sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate));
  if(!x.length)return null;
  const returns=x.map(r=>r.dailyReturn),positions=x.map(r=>r.position),ds=x.map(r=>r.marketDataDate),m=metricSet(returns,[],[],ds,positions),actionDays=new Set(x.filter(r=>(r as any).execution&&(r as any).execution.turnover>0).map(r=>(r as any).execution.recordedDate||r.marketDataDate)).size;
  return{days:x.length,totalReturn:returns.reduce((e,r)=>e*(1+r),1)-1,metrics:m,actionDays};
}

export function compareCandidateToIncumbent(phase5:Phase5Ledger,forward:ForwardLedger,version:string,incumbentVersion="VS13-v1.0"):ParetoComparison{
  const cRows=phase5.records.filter(r=>r.strategyVersion===version),iRows=forward.records.filter(r=>r.strategyVersion===incumbentVersion);
  const cDates=new Set(cRows.map(r=>r.marketDataDate)),iDates=new Set(iRows.map(r=>r.marketDataDate)),common=new Set([...cDates].filter(d=>iDates.has(d)));
  const candidate=commonMetrics(cRows,common),incumbent=commonMetrics(iRows,common),reasons:string[]=[];
  if(!candidate||!incumbent||common.size<63)return{version,incumbentVersion,commonDays:common.size,candidate,incumbent,merit:"NOT_EVALUATED",reasons:[`Only ${common.size} common Forward days; Pareto merit is not yet evaluated`]};
  const c=candidate.metrics,i=incumbent.metrics;
  const incumbentNoWorse=incumbent.totalReturn>=candidate.totalReturn&&i.maxDd>=c.maxDd&&i.sortino>=c.sortino&&i.calmar>=c.calmar&&incumbent.actionDays<=candidate.actionDays;
  const incumbentStrict=incumbent.totalReturn>candidate.totalReturn||i.maxDd>c.maxDd||i.sortino>c.sortino||i.calmar>c.calmar||incumbent.actionDays<candidate.actionDays;
  if(incumbentNoWorse&&incumbentStrict){reasons.push("Incumbent is no worse on common-period return, Max DD, Sortino, Calmar and Action Days and is strictly better on at least one");return{version,incumbentVersion,commonDays:common.size,candidate,incumbent,merit:"DOMINATED_BY_INCUMBENT",reasons}}
  const candidateNoWorse=candidate.totalReturn>=incumbent.totalReturn&&c.maxDd>=i.maxDd&&c.sortino>=i.sortino&&c.calmar>=i.calmar&&candidate.actionDays<=incumbent.actionDays;
  const candidateStrict=candidate.totalReturn>incumbent.totalReturn||c.maxDd>i.maxDd||c.sortino>i.sortino||c.calmar>i.calmar||candidate.actionDays<incumbent.actionDays;
  if(candidateNoWorse&&candidateStrict){reasons.push("Candidate is no worse on the five common-period Pareto dimensions and strictly better on at least one");return{version,incumbentVersion,commonDays:common.size,candidate,incumbent,merit:"PARETO_SUPPORTED",reasons}}
  reasons.push("Candidate and incumbent trade off at least one common-period Pareto dimension; human judgment is required");return{version,incumbentVersion,commonDays:common.size,candidate,incumbent,merit:"MIXED",reasons};
}
