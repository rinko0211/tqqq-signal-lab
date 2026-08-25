import { readFile, writeFile } from "node:fs/promises";

let pkg=await readFile("package.json","utf8");
if(!pkg.includes("tests/phase5-paper.test.ts")){
  const anchor='tests/phase5-forward.test.ts\"';
  if(!pkg.includes(anchor)) throw new Error("Current Phase 5 test registry anchor missing");
  pkg=pkg.replace(anchor,'tests/phase5-forward.test.ts tests/phase5-paper.test.ts\"');
  await writeFile("package.json",pkg);
}
await import("./integrate-phase5-product-v2.mjs");
