type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
};
type NasdaqRow = {
  date: string;
  close: string;
  volume: string;
  open: string;
  high: string;
  low: string;
};

export class ExternalDataUnavailableError extends Error {
  override name="ExternalDataUnavailableError";
  constructor(message:string,options?:{cause?:unknown}){super(message,options)}
}

async function officialFetch(label:string,url:string,headers:Record<string,string>){
  try{
    const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new ExternalDataUnavailableError(`${label}: HTTP ${response.status}`);
    return response;
  }catch(error){
    if(error instanceof ExternalDataUnavailableError)throw error;
    throw new ExternalDataUnavailableError(`${label}: 公式データ提供元へ接続できません (${error instanceof Error?error.message:String(error)})`,{cause:error});
  }
}

const number = (value: string) => Number(value.replace(/[$,]/g, ""));
const isoDate = (value: string) => {
  const [month, day, year] = value.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

async function fetchNasdaq(symbol: string, fromDate = "2016-01-01", minimumRows = 1500) {
  const today = new Date().toISOString().slice(0, 10);
  const url = `https://api.nasdaq.com/api/quote/${symbol}/historical?assetclass=etf&fromdate=${fromDate}&todate=${today}&limit=10000`;
  const response = await officialFetch(`${symbol}: Nasdaq`,url,{
      "User-Agent": "Mozilla/5.0 TQQQ-Signal-Lab/3.0",
      Accept: "application/json, text/plain, */*",
      Origin: "https://www.nasdaq.com",
      Referer: "https://www.nasdaq.com/",
  });
  const json = (await response.json()) as {
    data?: { tradesTable?: { rows?: NasdaqRow[] } };
  };
  const rows = json.data?.tradesTable?.rows || [];
  const bars = rows
    .flatMap((row) => {
      const values = [row.open, row.high, row.low, row.close].map(number);
      if (values.some((v) => !Number.isFinite(v) || v <= 0)) return [];
      return [
        {
          date: isoDate(row.date),
          open: values[0],
          high: values[1],
          low: values[2],
          close: values[3],
          adjClose: values[3],
          volume: number(row.volume) || 0,
        },
      ] as Bar[];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  if (bars.length < minimumRows)
    throw new ExternalDataUnavailableError(`${symbol}: Nasdaqデータ件数不足 (${bars.length})`);
  return bars;
}

async function fetchVix() {
  const response = await officialFetch(
    "VIX: Cboe",
    "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv",
    { "User-Agent": "TQQQ-Signal-Lab/3.0" },
  );
  const csv = await response.text();
  const bars = csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .flatMap((line) => {
      const [date, open, high, low, close] = line.split(","),
        values = [open, high, low, close].map(Number);
      if (values.some((v) => !Number.isFinite(v) || v <= 0)) return [];
      return [
        {
          date: isoDate(date),
          open: values[0],
          high: values[1],
          low: values[2],
          close: values[3],
          adjClose: values[3],
          volume: 0,
        },
      ] as Bar[];
    })
    .filter((bar) => bar.date >= "2008-01-01")
    .sort((a, b) => a.date.localeCompare(b.date));
  if (bars.length < 1500)
    throw new ExternalDataUnavailableError(`VIX: Cboeデータ件数不足 (${bars.length})`);
  return bars;
}

export async function fetchOfficialData(includeCross = false) {
  const [TQQQ, QQQ, SPY, VIX] = await Promise.all([
    fetchNasdaq("TQQQ"),
    fetchNasdaq("QQQ"),
    fetchNasdaq("SPY"),
    fetchVix(),
  ]);
  let crossSeries:Record<string,Bar[]>|undefined;
  if(includeCross){
    const crossTickers = [
      "TQQQ","QLD","QQQ",
      "UPRO","SSO","SPY",
      "SOXL","USD","SOXX",
      "TECL","ROM","XLK",
      "TNA","IWM",
    ] as const;
    const crossRows = await Promise.all(crossTickers.map(symbol => fetchNasdaq(symbol, "2006-01-01", 1000)));
    crossSeries = Object.fromEntries(crossTickers.map((symbol,i)=>[symbol,crossRows[i]]));
  }
  return {
    source: "Nasdaq Historical + Cboe VIX History",
    retrievedAt: new Date().toISOString(),
    series: { TQQQ, QQQ, SPY, VIX },
    ...(crossSeries?{crossSeries:{...crossSeries,VIX}}:{}),
    warnings: [
      "TQQQ・QQQ・SPYおよびPhase-1 cross-ticker候補はNasdaq HistoricalのClose/Lastを使用しています。配当再投資込みAdj Closeではないため、Buy & Hold比較は価格リターンです。",
      "Phase 1ではQLD/SSO/ROM/USDを実ETF価格で追加し、Synthetic leveraged historyは使用しません。",
      "USDとSOXLは異なる半導体指数を追跡するため、純粋な2x対3x倍率比較として扱いません。",
      "VIXはCboe公式VIX Historyを使用しています。",
      "外部データ取得時刻と各銘柄の最終日をデータ管理画面で確認してください。",
    ],
  };
}

/**
 * Bounded data surface for one human-approved non-TQQQ Production system.
 * It preserves the TQQQ/QQQ baseline series so the immutable incumbent Forward
 * track can continue independently while fetching only the selected Production
 * ticker/proxy rather than the closed research universe.
 */
export async function fetchProductionData(ticker:"UPRO"|"SSO"|"QLD",proxy:"SPY"|"QQQ") {
  const symbols=[...new Set(["TQQQ","QQQ","SPY",ticker,proxy])] as string[];
  const [rows,VIX]=await Promise.all([
    Promise.all(symbols.map(symbol=>fetchNasdaq(symbol,"2006-01-01",1000))),
    fetchVix(),
  ]);
  const bySymbol:Record<string,Bar[]>=Object.fromEntries(symbols.map((symbol,i)=>[symbol,rows[i]]));
  const crossSeries:Record<string,Bar[]>={...bySymbol,VIX};
  return{
    source:`Nasdaq Historical + Cboe VIX History · Production ${ticker}`,
    retrievedAt:new Date().toISOString(),
    series:{TQQQ:bySymbol.TQQQ,QQQ:bySymbol.QQQ,SPY:bySymbol.SPY,VIX},
    crossSeries,
    warnings:[
      `Formal Production data is bounded to the TQQQ/QQQ baseline plus ${ticker}/${proxy}, SPY and VIX; closed research-universe tickers are not fetched.`,
      "The TQQQ incumbent Forward remains sourced from TQQQ even after a different ticker becomes Formal Production.",
      "Actual ETF OHLC only. FX, tax and broker-specific realized friction are outside this market-data payload.",
    ],
  };
}

export async function fetchUproForwardData() {
  const [UPRO, SPY, VIX] = await Promise.all([
    fetchNasdaq("UPRO"),
    fetchNasdaq("SPY"),
    fetchVix(),
  ]);
  return {
    source: "Nasdaq Historical + Cboe VIX History · UPRO Track B",
    retrievedAt: new Date().toISOString(),
    series: { TQQQ: UPRO, QQQ: SPY, SPY, VIX },
    warnings: [
      "Track B UPROは独立取得です。失敗してもTrack Aの日次TQQQ Signalを変更・停止しません。",
      "UPRO実価格を使用し、Synthetic 3x returnは使用しません。",
    ],
  };
}

export async function fetchPhase5ForwardData() {
  const keys=["UPRO","SSO","QLD","SPY","QQQ","VIX"] as const;
  const settled=await Promise.allSettled([fetchNasdaq("UPRO"),fetchNasdaq("SSO"),fetchNasdaq("QLD"),fetchNasdaq("SPY"),fetchNasdaq("QQQ"),fetchVix()]);
  const series:Record<string,Bar[]>={},errors:Record<string,string[]>={};
  for(let i=0;i<keys.length;i++){const r=settled[i],k=keys[i];if(r.status==="fulfilled")series[k]=r.value;else errors[k]=[r.reason instanceof Error?r.reason.message:String(r.reason)];}
  return {
    source: "Nasdaq Historical + Cboe VIX History · Phase 5 Forward Gate",
    retrievedAt: new Date().toISOString(),
    series,errors,
    warnings: [
      "Phase 5 Forward Gate is isolated from the main Daily TQQQ workflow and legacy UPRO Track B.",
      "Actual ETF OHLC only; synthetic leveraged history is not used.",
      "A failed Phase 5 challenger feed is isolated; healthy frozen systems continue independently and the failed system remains non-selectable.",
      "No Phase 5 record may predate the frozen 2026-08-25 Forward start date.",
    ],
  };
}
