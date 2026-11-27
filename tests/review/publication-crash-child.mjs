// Test-only deterministic SIGKILL barriers. Never imported by production code.
import fs from 'node:fs/promises';import {readFileSync} from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
const [configPath,phase]=process.argv.slice(2),config=JSON.parse(readFileSync(configPath,'utf8'));
const original=fs.rename;const halt=async()=>{process.send?.({phase});setInterval(()=>{},1000);await new Promise(()=>{});};
fs.rename=async(from,to)=>{if(phase==='prepared'&&String(from)===config.out)await halt();if(phase==='initial-prepared'&&String(to)===config.out&&String(from).startsWith(config.out+'.staging-'))await halt();const result=await original(from,to);if(phase==='old-moved'&&String(from)===config.out)await halt();if(phase==='published'&&String(to)===config.out&&String(from).startsWith(config.out+'.staging-'))await halt();return result;};syncBuiltinESMExports();
const {AssetRegistry}=await import('../../src/registry/index.ts');const {buildBundle}=await import('../../src/builder/index.ts');const result=await buildBundle({...config,registry:new AssetRegistry(config.registry)});process.send?.({unexpected:result});process.exit(result.status==='PASS'?0:1);
