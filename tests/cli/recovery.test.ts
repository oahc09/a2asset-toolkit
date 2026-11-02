import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {join,relative} from 'node:path';
import {run} from '../../src/cli/main.js';
import {recoverPublication} from '../../src/builder/index.js';

test('recovery CLI requires explicit output, transaction identity, registry and owner-stopped acknowledgement',async()=>{
 for(const args of [[],['output'],['output','--registry','registry'],['output','--registry','registry','--transaction-id','synthetic'],['output','extra','--registry','registry','--transaction-id','synthetic','--confirm-owner-stopped']]){
  const result=await run(['recover',...args,'--json','--non-interactive']);
  assert.equal(result.status,'FAIL');
  assert.ok(result.diagnostics.some(d=>d.code==='E_SCHEMA_INVALID'));
 }
});
test('recovery CLI and SDK share fail-closed absent-journal behavior without creating directories',async()=>{
 const root=mkdtempSync(join(process.cwd(),'.synthetic-recovery-'));
 try{
  const out=relative(process.cwd(),join(root,'output')),registry=join(root,'registry'),transactionId='11111111-1111-4111-8111-111111111111';
  const sdk=await recoverPublication({workspace:process.cwd(),out,registry,transactionId,confirmOwnerStopped:true});
  const cli=await run(['recover',out,'--registry',registry,'--transaction-id',transactionId,'--confirm-owner-stopped','--json']);
  assert.notEqual(sdk.status,'PASS');assert.equal(cli.status,sdk.status);
  assert.deepEqual(cli.diagnostics,sdk.diagnostics);assert.deepEqual(readdirSync(root),[]);
 }finally{rmSync(root,{recursive:true,force:true});}
});
