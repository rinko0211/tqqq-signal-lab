export type RegimeFamily="RISK_ON"|"NEUTRAL"|"RISK_OFF"|"UNKNOWN";

export function regimeFamily(regime:string):RegimeFamily{
  if(["強い上昇","弱い上昇"].includes(regime))return"RISK_ON";
  if(regime==="レンジ")return"NEUTRAL";
  if(["高ボラ","下降トレンド","急落・危機"].includes(regime))return"RISK_OFF";
  return"UNKNOWN";
}

export function summarizeRegimeCoverage(regimes:string[]){
  const labels=new Set(regimes.filter(Boolean));
  const families=new Set([...labels].map(regimeFamily).filter(x=>x!=="UNKNOWN"));
  const riskOn=families.has("RISK_ON"),neutral=families.has("NEUTRAL"),riskOff=families.has("RISK_OFF");
  const nonRiskOn=neutral||riskOff;
  // Charter intent: uninterrupted bull history is insufficient. Apply the same
  // semantic rule to incumbent and challengers rather than comparing raw label counts.
  const formalCoverage=families.size>=2&&riskOn&&nonRiskOn;
  return{labels:[...labels].sort(),families:[...families].sort() as RegimeFamily[],riskOn,neutral,riskOff,nonRiskOn,formalCoverage};
}
