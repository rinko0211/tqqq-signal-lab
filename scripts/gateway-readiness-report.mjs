#!/usr/bin/env node
/**
 * Manual RESEARCH diagnostic. Public GitHub GET requests only.
 * Never fetches tokens, accesses trading accounts or produces executable orders.
 * Refuses missing pins. Do not source trust pins from the same request response.
 */
import {inspectReadOnlyGatewayReadiness} from '../lib/execution-gateway-readiness.mjs';

const args=process.argv.slice(2);
const values={};
for(const arg of args){
  const match=/^--(main-sha|state-sha|at)=([^\s]+)$/.exec(arg);
  if(!match||Object.hasOwn(values,match[1])){
    process.stderr.write('Usage: node scripts/gateway-readiness-report.mjs --main-sha=<independently pinned 40-hex SHA> --state-sha=<independently pinned 40-hex SHA> [--at=<ISO UTC timestamp>]\n');
    process.exit(2);
  }
  values[match[1]]=match[2];
}
const observedAt=values.at??new Date().toISOString();
const report=await inspectReadOnlyGatewayReadiness({
  expectedMainSha:values['main-sha'],
  expectedStateSha:values['state-sha'],
  observedAt
});
process.stdout.write(JSON.stringify(report,null,2)+'\n');
// Exit code 0 means READ-ONLY report generated, not investment approval.
// Exit code 2 means trust/data unavailable; never attempt implicit fallback.
process.exitCode=report.status==='CONTINUE_FORWARD_RESEARCH_ONLY'?0:2;
