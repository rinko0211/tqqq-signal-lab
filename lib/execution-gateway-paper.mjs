/**
 * Execution Gateway v0: offline PAPER intent evaluator only.
 * No network I/O, broker adapter, credential access, persistence or executable order.
 * Not imported by the live PWA or scheduled operations.
 */
import { createHash } from 'node:crypto';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const TARGETS = new Set([0, 0.25, 0.5, 0.75, 1]);
const isDate = x => typeof x === 'string' && DATE.test(x) && !Number.isNaN(Date.parse(x + 'T00:00:00Z')) && new Date(x + 'T00:00:00Z').toISOString().slice(0,10) === x;
const isTimestamp = x => typeof x === 'string' && ISO.test(x) && Number.isFinite(Date.parse(x));
const finite = x => typeof x === 'number' && Number.isFinite(x);
const positive = x => finite(x) && x > 0;
const nonnegative = x => finite(x) && x >= 0;
const integer = x => Number.isSafeInteger(x) && x >= 0;
const hashId = s => createHash('sha256').update(s, 'utf8').digest('hex');
const roundMoney = x => Math.round((x + Number.EPSILON) * 100) / 100;

export function evaluatePaperOrderIntent(input) {
  const reject = reason => ({status:'REJECTED',reason,brokerOrderAllowed:false,executionAuthority:'NONE',intent:null});
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reject('INVALID_INPUT');
  const {signal,status,production,session,snapshot,quote,policy,priorIntentIds,observedAt} = input;

  // HARD BOUNDARY: no live execution authority can ever be returned.
  if (policy?.mode !== 'PAPER_ONLY') return reject('PAPER_MODE_REQUIRED');
  if (policy?.killSwitch !== false) return reject('KILL_SWITCH_ACTIVE');
  if (production?.mode !== 'RESEARCH' || production?.approvedByHuman !== false || production?.selectedTicker != null) return reject('PRODUCTION_AUTHORITY_NOT_ALLOWED');
  if (!isTimestamp(observedAt)) return reject('INVALID_OBSERVATION_TIME');
  if (!signal || signal.platformMode !== 'RESEARCH' || signal.state !== 'latest' || !isTimestamp(signal.generatedAt)) return reject('INVALID_SIGNAL');
  if (!status || status.actionStatus !== 'success' || status.state !== 'latest' || !isTimestamp(status.generatedAt) || !Array.isArray(status.errors) || status.errors.length) return reject('INVALID_UPSTREAM_STATUS');
  if (status.generatedAt !== signal.generatedAt || status.marketDataDate !== signal.dataDate || status.signalDate !== signal.signal?.date) return reject('GENERATION_MISMATCH');
  if (signal.assetTicker !== 'TQQQ' || signal.strategyVersion !== 'VS13-v1.0' || !Array.isArray(policy.allowlist) || !policy.allowlist.includes('TQQQ')) return reject('UNAPPROVED_ASSET_OR_STRATEGY');
  if (!isDate(signal.dataDate) || signal.signal?.date !== signal.dataDate || !TARGETS.has(signal.signal?.target)) return reject('INVALID_SIGNAL_TARGET');
  if (!isDate(signal.signal.executionDate) || !isDate(session?.completedDataDate) || !isDate(session?.nextLegalOpenDate)) return reject('INVALID_MARKET_CALENDAR_EVIDENCE');
  if (session.completedDataDate !== signal.dataDate || session.nextLegalOpenDate !== signal.signal.executionDate || session.nextLegalOpenDate <= session.completedDataDate) return reject('MARKET_CALENDAR_MISMATCH');
  const now=Date.parse(observedAt), generated=Date.parse(signal.generatedAt);
  if (generated > now || now - generated > 96*60*60*1000) return reject('STALE_OR_FUTURE_SIGNAL');
  // Deliberately more restrictive than NYSE open time, including at UTC day roll.
  // Independent verified exchange calendar/open clock is a future prerequisite.
  if (observedAt.slice(0,10) >= signal.signal.executionDate) return reject('EXECUTION_DATE_REACHED_OR_EXPIRED');

  if (!snapshot || snapshot.source !== 'OFFLINE_PAPER_FIXTURE' || snapshot.accountType !== 'PAPER' || snapshot.currency !== 'USD' || !isTimestamp(snapshot.asOf)) return reject('INVALID_PAPER_SNAPSHOT');
  if (Date.parse(snapshot.asOf)>now || now-Date.parse(snapshot.asOf)>24*60*60*1000) return reject('STALE_PAPER_SNAPSHOT');
  if (!positive(snapshot.netLiquidationUSD) || !nonnegative(snapshot.settledCashUSD) || !integer(snapshot.currentTqqqShares) || !integer(snapshot.pendingOrders) || snapshot.pendingOrders!==0) return reject('INVALID_OR_UNRECONCILED_SNAPSHOT');
  if (!quote || quote.ticker !== 'TQQQ' || !positive(quote.priceUSD) || !isTimestamp(quote.asOf) || Date.parse(quote.asOf)>now || now-Date.parse(quote.asOf)>24*60*60*1000) return reject('INVALID_OR_STALE_PAPER_QUOTE');
  if (!Array.isArray(priorIntentIds) || !priorIntentIds.every(x=>typeof x === 'string' && /^[a-f0-9]{64}$/.test(x))) return reject('INVALID_DEDUPE_EVIDENCE');
  if (!positive(policy.maxOrderNotionalUSD) || !positive(policy.maxPositionNotionalUSD) || !positive(policy.maxPositionFraction) || policy.maxPositionFraction>1) return reject('INVALID_RISK_POLICY');

  const price=quote.priceUSD, currentQty=snapshot.currentTqqqShares;
  const currentNotional=currentQty*price;
  if (!Number.isFinite(currentNotional) || currentNotional>snapshot.netLiquidationUSD*1.01 ||
      snapshot.settledCashUSD+currentNotional>snapshot.netLiquidationUSD*1.01) return reject('INVALID_POSITION_VALUATION');
  const targetQty=Math.floor((signal.signal.target*snapshot.netLiquidationUSD)/price);
  if (!Number.isSafeInteger(targetQty) || targetQty<0) return reject('INVALID_TARGET_QUANTITY');
  const delta=targetQty-currentQty;
  const intentId=hashId(['PAPER_V1',signal.strategyVersion,signal.assetTicker,signal.signal.executionDate,signal.signal.target,snapshot.accountId??'offline-paper'].join('|'));
  if (new Set(priorIntentIds).has(intentId)) return reject('DUPLICATE_INTENT');
  if (delta===0) return {status:'NO_ACTION',reason:'ALREADY_AT_TARGET',brokerOrderAllowed:false,executionAuthority:'NONE',intent:null};
  const orderNotional=Math.abs(delta)*price, postTradeNotional=targetQty*price;
  if (!Number.isFinite(orderNotional) || orderNotional>policy.maxOrderNotionalUSD) return reject('ORDER_NOTIONAL_LIMIT');
  if (postTradeNotional>policy.maxPositionNotionalUSD || postTradeNotional>snapshot.netLiquidationUSD*policy.maxPositionFraction) return reject('POSITION_LIMIT');
  if (delta>0 && orderNotional*1.0008>snapshot.settledCashUSD) return reject('INSUFFICIENT_SETTLED_PAPER_CASH');

  const intent=Object.freeze({
    intentId,mode:'PAPER_ONLY',ticker:'TQQQ',strategyVersion:'VS13-v1.0',
    signalDate:signal.dataDate,plannedNYSEOpenDate:signal.signal.executionDate,
    side:delta>0?'BUY':'SELL',quantity:Math.abs(delta),
    estimatedNotionalUSD:roundMoney(orderNotional),targetExposure:signal.signal.target,
    referencePriceUSD:price,brokerOrderAllowed:false
  });
  return {status:'PAPER_INTENT',reason:'OFFLINE_SIMULATION_ONLY',brokerOrderAllowed:false,executionAuthority:'NONE',intent};
}
