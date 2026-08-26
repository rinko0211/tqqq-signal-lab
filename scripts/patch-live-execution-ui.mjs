import fs from 'node:fs';
const path='app/page.tsx';let s=fs.readFileSync(path,'utf8');
const from='  const execute = nextExecutionDate(signal.date);';
const to='  const execute = signal.executionDate || nextExecutionDate(signal.date);';
const n=s.split(from).length-1;if(n!==1)throw new Error(`Expected one live execution anchor, found ${n}`);s=s.replace(from,to);fs.writeFileSync(path,s);console.log('Live execution UI causality patch applied');