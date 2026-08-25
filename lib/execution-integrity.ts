import { nextExecutionDate } from "./engine.ts";

const NY_ZONE = "America/New_York";
const MARKET_OPEN_MINUTES = 9 * 60 + 30;

function nyClock(isoTimestamp: string) {
  const date = new Date(isoTimestamp);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid Forward recordedAt: ${isoTimestamp}`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || "";
  const localDate = `${get("year")}-${get("month")}-${get("day")}`;
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  return { localDate, minutes };
}

function weekday(date: string) {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d !== 0 && d !== 6;
}

/**
 * Earliest open at which a Forward signal can legally be executed.
 *
 * Historical signal date alone is insufficient when the market-data provider
 * publishes the close late. A signal first observed after its theoretical t+1
 * open must never be filled retroactively at that already-passed open.
 *
 * This function deliberately does not rewrite historical market calendars.
 * If the returned weekday is a US market holiday, the ledger executor naturally
 * waits for the first later Dataset bar, which remains conservative and causal.
 */
export function earliestLegalExecutionDate(signalDate: string, recordedAt: string) {
  const theoretical = nextExecutionDate(signalDate);
  const { localDate, minutes } = nyClock(recordedAt);

  if (localDate < theoretical) return theoretical;
  if (localDate === theoretical) {
    return minutes < MARKET_OPEN_MINUTES ? theoretical : nextExecutionDate(theoretical);
  }

  // The signal became available only after the theoretical execution date.
  // It may use today's open only when it was actually known before 09:30 ET.
  if (weekday(localDate) && minutes < MARKET_OPEN_MINUTES) return localDate;
  return nextExecutionDate(localDate);
}
