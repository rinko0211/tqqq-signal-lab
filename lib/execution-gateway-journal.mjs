/**
 * Gateway v1 offline-only reservation journal.
 * Durable *paper intent* claims, not orders. No broker client, network, dispatch,
 * fills, credentials, execution authority or production scheduling.
 *
 * The caller must use a trusted local filesystem. This module does not claim
 * distributed exactly-once guarantees across hosts, filesystems or broker APIs.
 */
import { createHash } from 'node:crypto';
import { mkdir, lstat, open, readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { evaluatePaperOrderIntent } from './execution-gateway-paper.mjs';

const MANIFEST_NAME = 'PAPER_ONLY_MANIFEST.json';
const HALT_NAME = 'HALT';
const MANIFEST = Object.freeze({schemaVersion:1, mode:'PAPER_ONLY', brokerOrderAllowed:false, executionAuthority:'NONE'});
const sha = x => createHash('sha256').update(x, 'utf8').digest('hex');
const result = (status,reason,intent=null) => ({status,reason,intent,brokerOrderAllowed:false,executionAuthority:'NONE'});
const safeAccount = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s);
const isTime = s => typeof s === 'string' && !Number.isNaN(Date.parse(s)) && /^\d{4}-\d{2}-\d{2}T/.test(s);
const isFiniteNonnegative = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;

async function syncDirectory(dir) {
  const h = await open(dir, 'r');
  try { await h.sync(); } finally { await h.close(); }
}
async function writeExclusive(path, body) {
  const h = await open(path, 'wx', 0o600);
  try {
    await h.writeFile(body, {encoding:'utf8'});
    await h.sync();
  } finally { await h.close(); }
}
async function validStore(dir) {
  if (typeof dir !== 'string' || !isAbsolute(dir)) return false;
  const stat = await lstat(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
  const m = JSON.parse(await readFile(join(dir, MANIFEST_NAME), 'utf8'));
  return Object.keys(MANIFEST).every(k => m[k] === MANIFEST[k]) &&
    Object.keys(m).length === Object.keys(MANIFEST).length;
}
async function haltExists(dir) {
  try { await lstat(join(dir, HALT_NAME)); return true; }
  catch (err) { if (err?.code === 'ENOENT') return false; throw err; }
}

/** Creates a NEW, private local paper journal; will never silently reuse a directory. */
export async function initializeOfflinePaperJournal(directory) {
  if (typeof directory !== 'string' || !isAbsolute(directory)) throw new Error('ABSOLUTE_PRIVATE_DIRECTORY_REQUIRED');
  await mkdir(directory, {recursive:false, mode:0o700});
  await writeExclusive(join(directory, MANIFEST_NAME), JSON.stringify(MANIFEST) + '\n');
  await syncDirectory(directory);
  return {mode:'PAPER_ONLY',brokerOrderAllowed:false,executionAuthority:'NONE'};
}

/** Sticky HALT. No programmatic unlock by design. HALT also blocks an uncertain state. */
export async function haltOfflinePaperJournal(directory, reason='OPERATOR_HALT') {
  try {
    if (!await validStore(directory)) return result('REJECTED','STORE_UNAVAILABLE');
    if (await haltExists(directory)) return result('HALTED','KILL_SWITCH_LATCHED');
    if (typeof reason !== 'string' || !/^[A-Z0-9_-]{1,64}$/.test(reason)) return result('REJECTED','INVALID_HALT_REASON');
    try {
      await writeExclusive(join(directory, HALT_NAME), JSON.stringify({schemaVersion:1,reason})+'\n');
    } catch (err) {
      if (err?.code !== 'EEXIST') return result('REJECTED','STORE_UNAVAILABLE');
    }
    await syncDirectory(directory);
    return result('HALTED','KILL_SWITCH_LATCHED');
  } catch { return result('REJECTED','STORE_UNAVAILABLE'); }
}
function reconcileMockBroker(input, mock) {
  const account=input?.snapshot;
  if (!account || !safeAccount(account.accountId) || !mock || mock.source!=='OFFLINE_BROKER_FIXTURE' ||
      mock.accountType!=='PAPER' || mock.currency!=='USD' || mock.accountId!==account.accountId ||
      !isTime(mock.asOf) || mock.asOf!==account.asOf) return false;
  if (![mock.netLiquidationUSD, mock.settledCashUSD].every(isFiniteNonnegative) ||
      !Number.isSafeInteger(mock.currentTqqqShares) || mock.currentTqqqShares<0 ||
      !Number.isSafeInteger(mock.pendingOrders) || mock.pendingOrders!==0) return false;
  return ['netLiquidationUSD','settledCashUSD','currentTqqqShares','pendingOrders']
    .every(k => mock[k]===account[k]);
}
function payloadFor(input,intent) {
  const accountId=input.snapshot.accountId;
  const slotKey=['PAPER_SESSION_V1',accountId,intent.strategyVersion,intent.ticker,intent.plannedNYSEOpenDate].join('|');
  const slotId=sha(slotKey);
  const record={
    schemaVersion:1,mode:'PAPER_ONLY',slotId,accountId,
    signalGeneratedAt:input.signal.generatedAt,signalDate:intent.signalDate,
    intent,brokerOrderAllowed:false,executionAuthority:'NONE'
  };
  const body=JSON.stringify(record);
  return {slotId,record,body,digest:sha(body)};
}

/**
 * Re-evaluates the v0 risk gate and independently checks a SECOND OFFLINE FIXTURE.
 * Atomic O_EXCL slot creation serializes same-session claims on a local filesystem.
 * Any corruption or uncertain write remains a permanent fail-closed barrier.
 */
export async function reserveOfflinePaperIntent({directory,input,offlineBrokerSnapshot}={}) {
  try {
    if (!await validStore(directory)) return result('REJECTED','STORE_UNAVAILABLE');
    if (await haltExists(directory)) return result('HALTED','KILL_SWITCH_LATCHED');
    const evaluation=evaluatePaperOrderIntent(input);
    if (evaluation.status !== 'PAPER_INTENT') {
      return result(evaluation.status,evaluation.reason);
    }
    if (!reconcileMockBroker(input,offlineBrokerSnapshot)) return result('REJECTED','MOCK_BROKER_RECONCILIATION_FAILED');
    const {slotId,record,body,digest}=payloadFor(input,evaluation.intent);
    const path=join(directory,slotId+'.json');
    const persisted=JSON.stringify({record,digest})+'\n';
    try {
      await writeExclusive(path,persisted);
      await syncDirectory(directory);
    } catch (err) {
      if (err?.code!=='EEXIST') return result('REJECTED','JOURNAL_WRITE_UNCERTAIN');
      // Prior record is authoritative. Incomplete/tampered records never
      // release the slot, even if this attempt is otherwise valid.
      let prior;
      try { prior=JSON.parse(await readFile(path,'utf8')); }
      catch { return result('REJECTED','UNRESOLVED_JOURNAL_SLOT'); }
      if (!prior || prior.digest!==sha(JSON.stringify(prior.record)) ||
          prior.record?.slotId!==slotId || prior.record?.mode!=='PAPER_ONLY' ||
          prior.record?.executionAuthority!=='NONE' || prior.record?.brokerOrderAllowed!==false ||
          !prior.record?.intent || prior.record?.intent?.brokerOrderAllowed!==false) {
        return result('REJECTED','UNRESOLVED_JOURNAL_SLOT');
      }
      return result('REJECTED',prior.record.intent.intentId === evaluation.intent.intentId
        ? 'DUPLICATE_PAPER_SESSION' : 'CONFLICTING_PAPER_SESSION');
    }
    // A HALT written during the reservation must prevent even PAPER approval.
    // The disk claim remains permanently reserved either way.
    if (await haltExists(directory)) return result('HALTED','KILL_SWITCH_LATCHED');
    return result('PAPER_RESERVED','OFFLINE_JOURNAL_ONLY',Object.freeze({...evaluation.intent}));
  } catch { return result('REJECTED','STORE_UNAVAILABLE'); }
}
