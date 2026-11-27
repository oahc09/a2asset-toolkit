// Synthetic cleanup I/O fault, not a claim about actual filesystem permissions.
import fs from 'node:fs/promises';import {readFileSync} from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
const input=JSON.parse(readFileSync(process.argv[2],'utf8')),journal=JSON.parse(readFileSync(input.workspace+'/'+input.out+'.writer-lock/transaction.json','utf8'));const original=fs.rm;
fs.rm=async(path,options)=>{if(String(path)===journal.staging){const error=new Error('Synthetic cleanup permission refusal');error.code='EACCES';throw error;}return original(path,options);};syncBuiltinESMExports();
const {recoverPublication}=await import('../../src/builder/recovery.ts');process.stdout.write(JSON.stringify(await recoverPublication(input)));
