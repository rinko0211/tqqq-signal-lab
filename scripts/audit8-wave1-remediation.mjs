import fs from "node:fs";

const primary=`import {freshness,nextExecutionDate} from "./engine.ts";
import {assertForwardLedgerInternalIntegrity,type ForwardLedger} from "./forward.ts";
import {nyseExecutionWindow,type NyseExecutionWindow} from "./market-calendar.ts";
import {
  operationalAuthorityBundleIsCoherent,
  type AuthorityBundleResult,
  type OperationalRuntimeAuthority,
  type OperationalSignalAuthority,
} from "./operational-authority.ts";
import type {ProductionConfig} from "./production.ts";

export type PrimaryActionCode=
  |"INCREASE"
  |"REDUCE"
  |"HOLD"
  |"TARGET_ONLY"
  |"REENTER_HOLDINGS"
  |"WAIT"
  |"NO_ACTION_EXPIRED"
  |"CHECK_DATA";

export type PrimarySignalArtifact=OperationalSignalAuthority&{
  assetTicker?:string;
  strategyVersion?:string;
  signal?:{date:string;target:number;previousTarget:number;executionDate?:string};
};
export type PrimaryHoldings={ratio?:string;ticker?:string;version?:string};
export type PrimaryActionResult={
  code:PrimaryActionCode;
  message:string;
  target:number;
  currentTicker:string;
  currentVersion:string;
  holdingsMatch:boolean;
  actual:number|null;
  executionDate:string|undefined;
  executionWindow:NyseExecutionWindow|null;
  signalChange:boolean;
  executionMissed:boolean;
  executionActionable:boolean;
  authorityBundle:AuthorityBundleResult;
  authorityUnsafe:boolean;
  signalUnsafe:boolean;
  freshnessDate:string|undefined;
};

/**
 * Product-level primary action boundary used by the actual UI and Audit 8.
 * Operational freshness is derived only from the operational Signal artifact.
 * The optional freshnessDate input remains compatibility-only and cannot upgrade
 * or downgrade operational trading authority.
 */
export function derivePrimaryAction(args:{
  signal:PrimarySignalArtifact|null|undefined;
  status:OperationalRuntimeAuthority|null|undefined;
  forward:ForwardLedger|null|undefined;
  production:ProductionConfig|null|undefined;
  now:string;
  holdings:PrimaryHoldings;
  freshnessDate?:string;
}):PrimaryActionResult{
  const signal=args.signal?.signal;
  const target=signal?.target??0;
  const currentTicker=args.signal?.assetTicker||"TQQQ";
  const currentVersion=args.signal?.strategyVersion||"VS13-v1.0";
  const holdingsMatch=args.holdings.ticker
    ?args.holdings.ticker===currentTicker&&(!args.holdings.version||args.holdings.version===currentVersion)
    :currentTicker==="TQQQ";
  const ratio=holdingsMatch?(args.holdings.ratio??""):"";
  const parsedRatio=ratio===""?null:Number(ratio);
  const holdingsNumericUnsafe=ratio!==""&&(ratio.trim()===""||!Number.isFinite(parsedRatio)||parsedRatio!<0||parsedRatio!>100);
  const actual=ratio===""||holdingsNumericUnsafe?null:(parsedRatio as number)/100;
  const signalNumericUnsafe=Boolean(signal&&(
    signal.date!==args.signal?.dataDate||
    !Number.isFinite(signal.target)||!Number.isFinite(signal.previousTarget)||
    signal.target<0||signal.target>1||signal.previousTarget<0||signal.previousTarget>1
  ));
  const executionDate=signal?.executionDate||(signal?nextExecutionDate(signal.date):undefined);
  const executionWindow=executionDate?nyseExecutionWindow(executionDate,args.now):null;
  const signalChange=Boolean(signal&&!signalNumericUnsafe&&Math.abs(signal.target-signal.previousTarget)>=.001);
  const executionMissed=Boolean(signalChange&&executionWindow==="OPEN_PASSED");
  const executionActionable=Boolean(signalChange&&executionWindow==="UPCOMING_OPEN");
  const authorityBundle=operationalAuthorityBundleIsCoherent({signal:args.signal,status:args.status,production:args.production,forward:args.forward});
  const authorityUnsafe=!authorityBundle.ok;
  let forwardIntegrityUnsafe=false;
  if(args.forward){try{assertForwardLedgerInternalIntegrity(args.forward)}catch{forwardIntegrityUnsafe=true}}
  void args.freshnessDate;
  const freshnessDate=args.signal?.dataDate;
  const fresh=freshnessDate?freshness(freshnessDate,args.now):null;
  const signalUnsafe=Boolean(authorityUnsafe||forwardIntegrityUnsafe||signalNumericUnsafe||holdingsNumericUnsafe||args.status?.state==="failed"||fresh?.stale);

  if(signalUnsafe)return{code:"CHECK_DATA",message:"売買しない：データ/Signalが安全確認できません。System Statusを確認してください",target,currentTicker,currentVersion,holdingsMatch,actual,executionDate,executionWindow,signalChange,executionMissed,executionActionable,authorityBundle,authorityUnsafe,signalUnsafe,freshnessDate};
  if(executionMissed)return{code:"NO_ACTION_EXPIRED",message:\`売買しない：予定始値（\${executionDate}）を通過しています。過去の始値を追認せず、次のDaily Signal更新後に再確認してください\`,target,currentTicker,currentVersion,holdingsMatch,actual,executionDate,executionWindow,signalChange,executionMissed,executionActionable,authorityBundle,authorityUnsafe,signalUnsafe,freshnessDate};
  if(!holdingsMatch)return{code:"REENTER_HOLDINGS",message:\`運用Tickerが\${currentTicker}へ切り替わりました。旧Tickerの保有値は流用しません。\${currentTicker}の保有状況を再入力してください\`,target,currentTicker,currentVersion,holdingsMatch,actual,executionDate,executionWindow,signalChange,executionMissed,executionActionable,authorityBundle,authorityUnsafe,signalUnsafe,freshnessDate};
  if(actual===null)return{code:"TARGET_ONLY",message:"保有状況未入力：目標のみ表示",target,currentTicker,currentVersion,holdingsMatch,actual,executionDate,executionWindow,signalChange,executionMissed,executionActionable,authorityBundle,authorityUnsafe,signalUnsafe,freshnessDate};
  if(!signalChange)return{code:"HOLD",message:"変更なし：現在Signalに新規売買指示はありません",target,currentTicker,currentVersion,holdingsMatch,actual,executionDate,executionWindow,signalChange,executionMissed,executionActionable,authorityBundle,authorityUnsafe,signalUnsafe,freshnessDate};
  if(!executionActionable)return{code:"WAIT",message:"売買しない：有効な次回始値の実行ウィンドウを確認できません。次のDaily Signal更新後に再確認してください",target,currentTicker,currentVersion,holdingsMatch,actual,executionDate,executionWindow,signalChange,executionMissed,executionActionable,authorityBundle,authorityUnsafe,signalUnsafe,freshnessDate};
  if(Math.abs(actual-target)<.001)return{code:"HOLD",message:"変更なし",target,currentTicker,currentVersion,holdingsMatch,actual,executionDate,executionWindow,signalChange,executionMissed,executionActionable,authorityBundle,authorityUnsafe,signalUnsafe,freshnessDate};
  if(actual<target)return{code:"INCREASE",message:\`\${currentTicker}比率を\${target*100}%まで増加\`,target,currentTicker,currentVersion,holdingsMatch,actual,executionDate,executionWindow,signalChange,executionMissed,executionActionable,authorityBundle,authorityUnsafe,signalUnsafe,freshnessDate};
  return{code:"REDUCE",message:\`\${currentTicker}比率を\${target*100}%まで縮小\`,target,currentTicker,currentVersion,holdingsMatch,actual,executionDate,executionWindow,signalChange,executionMissed,executionActionable,authorityBundle,authorityUnsafe,signalUnsafe,freshnessDate};
}
`;
fs.writeFileSync("lib/primary-action.ts",primary);

const pagePath="app/page.tsx";
let page=fs.readFileSync(pagePath,"utf8");
page=page.replace("primaryAction=derivePrimaryAction({signal:dailySignal,status:runtimeStatus,forward:forwardLedger,production:productionConfig,now:now.toISOString(),holdings,freshnessDate:latestDate}),","primaryAction=derivePrimaryAction({signal:dailySignal,status:runtimeStatus,forward:forwardLedger,production:productionConfig,now:now.toISOString(),holdings}),");
if(page.includes("derivePrimaryAction({signal:dailySignal,status:runtimeStatus,forward:forwardLedger,production:productionConfig,now:now.toISOString(),holdings,freshnessDate:latestDate})"))throw Error("Audit 8 M02 patch failed: research freshness remains connected to primary action");
fs.writeFileSync(pagePath,page);

const pkgPath="package.json";
const pkg=JSON.parse(fs.readFileSync(pkgPath,"utf8"));
for(const key of ["test:core","test:ops"]){
  if(typeof pkg.scripts?.[key]!=="string")throw Error(`Missing ${key}`);
  if(!pkg.scripts[key].includes("tests/audit8-independent-blackbox.test.ts"))pkg.scripts[key]+=" tests/audit8-independent-blackbox.test.ts";
}
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+"\n");
