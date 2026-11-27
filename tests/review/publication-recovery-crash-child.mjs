// Test-only barrier after verified staged cleanup, before completion journal removal.
import fs from 'node:fs/promises';import {readFileSync} from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
const input=JSON.parse(readFileSync(process.argv[2],'utf8')),staging=JSON.parse(readFileSync(input.workspace+'/'+input.out+'.writer-lock/transaction.json','utf8')).staging;const original=fs.rm;
fs.rm=async(path,options)=>{const result=await original(path,options);if(String(path)===staging){process.send?.({phase:'cleanup'});setInterval(()=>{},1000);await new Promise(()=>{});}return result;};syncBuiltinESMExports();
const {recoverPublication}=await import('../../src/builder/recovery.ts');process.send?.({unexpected:await recoverPublication(input)});process.exit(1);
