import {earliestLegalNyseOpen} from "./market-calendar.ts";

/**
 * Earliest NYSE core open at which a Forward signal can legally be executed.
 * The shared market calendar enforces weekends, scheduled exchange holidays,
 * New York clock/DST and the 09:30 ET causality boundary.
 */
export function earliestLegalExecutionDate(signalDate:string,recordedAt:string){
  return earliestLegalNyseOpen(signalDate,recordedAt);
}
