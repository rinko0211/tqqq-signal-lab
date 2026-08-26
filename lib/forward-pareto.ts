import {metricSet,type Metrics} from "./engine.ts";
import {isNyseSession} from "./market-calendar.ts";
import type {ForwardLedger} from "./forward.ts";
import type {Phase5Ledger} from "./phase5-forward.ts";

export type ParetoMerit="NOT_EVALUATED"|"PARETO_SUPPORTED"|"MIXED"|"DOMINATED_BY_INCUMBENT";
export type CommonForwardMetrics={days:number;totalReturn:number;metrics:Metrics;actionDays:number};
export type ParetoComparison={version:string;incumbentVersion:string;commonDays:number;candidate:CommonForwardMetrics|null;incumbent:CommonForwardMetrics|null;merit:ParetoMerit;reasons:string[]};

type ComparableExecution={turnover:number;recordedDate:string};
type ComparableRow={marketDataDate:string;dailyReturn:number;position:number;execution?:ComparableExecution|null};

function scheduledSessions(start:string,end:string){
  const out:string[]=[];if(!start||!end||end<start)return out;
  const d=new Date(`${start}T12:00:00Z`);let guard=0;
  while(d.toISOString().slice(0,10)<=end&&guard++<10000){const date=d.toISOString().slice(0,10);if(isNyseSession(date))out.push(date);d.setUTCDate(d.getUTCDate()+1)}
  return out;
}

function cleanCommonSuffix(cRows:ComparableRow[],iRows:ComparableRow[]){
  const c=[...cRows].sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate)),i=[...iRows].sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate));
  if(!c.length||!i.length)return[];
  const start=[c[0].marketDataDate,i[0].marketDataDate].sort().at(-1)!,end=[c.at(-1)!.marketDataDate,i.at(-1)!.marketDataDate].sort()[0];
  const expected=scheduledSessions(start,end),cs=new Set(c.map(r=>r.marketDataDate)),is=new Set(i.map(r=>r.marketDataDate));
  let lastMissing=-1;for(let n=0;n<expected.length;n++)if(!cs.has(expected[n])||!is.has(expected[n]))lastMissing=n;
  return expected.slice(lastMissing+1);
}

function commonMetrics(rows:ComparableRow[],dates:string[]):CommonForwardMetrics|null{
  const set=new Set(dates),x=rows.filter(r=>set.has(r.marketDataDate)).sort((a,b)=>a.marketDataDate.localeCompare(b.marketDataDate));
  if(!x.length)return null;
  const returns=x.map(r=>r.dailyReturn),positions=x.map(r=>r.position),ds=x.map(r=>r.marketDataDate),m=metricSet(returns,[],[],ds,positions),actionDays=new Set(x.filter(r=>r.execution&&r.execution.turnover>0).map(r=>r.execution!.recordedDate||r.marketDataDate)).size;
  return{days:x.length,totalReturn:returns.reduce((e,r)=>e*(1+r),1)-1,metrics:m,actionDays};
}

export function compareCandidateToIncumbent(phase5:Phase5Ledger,forward:ForwardLedger,version:string,incumbentVersion="VS13-v1.0"):ParetoComparison{
  const cRows=phase5.records.filter(r=>r.strategyVersion===version),iRows=forward.records.filter(r=>r.strategyVersion===incumbentVersion),cleanDates=cleanCommonSuffix(cRows,iRows);
  const candidate=commonMetrics(cRows,cleanDates),incumbent=commonMetrics(iRows,cleanDates),reasons:string[]=[];
  if(!candidate||!incumbent||cleanDates.length<63)return{version,incumbentVersion,commonDays:cleanDates.length,candidate,incumbent,merit:"NOT_EVALUATED",reasons:[`Only ${cleanDates.length} consecutive clean common NYSE sessions since the latest missing session; Pareto merit requires 63`]};
  const c=candidate.metrics,i=incumbent.metrics;
  const incumbentNoWorse=incumbent.totalReturn>=candidate.totalReturn&&i.maxDd>=c.maxDd&&i.sortino>=c.sortino&&i.calmar>=c.calmar&&incumbent.actionDays<=candidate.actionDays;
  const incumbentStrict=incumbent.totalReturn>candidate.totalReturn||i.maxDd>c.maxDd||i.sortino>c.sortino||i.calmar>c.calmar||incumbent.actionDays<candidate.actionDays;
  if(incumbentNoWorse&&incumbentStrict){reasons.push("Incumbent is no worse on clean common-period return, Max DD, Sortino, Calmar and Action Days and is strictly better on at least one");return{version,incumbentVersion,commonDays:cleanDates.length,candidate,incumbent,merit:"DOMINATED_BY_INCUMBENT",reasons}}
  const candidateNoWorse=candidate.totalReturn>=incumbent.totalReturn&&c.maxDd>=i.maxDd&&c.sortino>=i.sortino&&c.calmar>=i.calmar&&candidate.actionDays<=incumbent.actionDays;
  const candidateStrict=candidate.totalReturn>incumbent.totalReturn||c.maxDd>i.maxDd||c.sortino>i.sortino||c.calmar>i.calmar||candidate.actionDays<incumbent.actionDays;
  if(candidateNoWorse&&candidateStrict){reasons.push("Candidate is no worse on the five clean common-period Pareto dimensions and strictly better on at least one");return{version,incumbentVersion,commonDays:cleanDates.length,candidate,incumbent,merit:"PARETO_SUPPORTED",reasons}}
  reasons.push("Candidate and incumbent trade off at least one clean common-period Pareto dimension; human judgment is required");return{version,incumbentVersion,commonDays:cleanDates.length,candidate,incumbent,merit:"MIXED",reasons};
}
