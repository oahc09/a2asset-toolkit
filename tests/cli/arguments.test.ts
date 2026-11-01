import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseArguments} from '../../src/cli/arguments.js';import {run,exitCode} from '../../src/cli/main.js';
test('reject unknown/duplicate/missing options, no silent option override',()=>{for(const a of [['inspect','--unknown'],['inspect','--json','--json'],['import','--registry']])assert.throws(()=>parseArguments(a));});
test('inspect returns machine readable failure on missing or malformed input',async()=>assert.equal((await run(['inspect','/does-not-exist','--json'])).status,'FAIL'));
test('exit taxonomy distinguishes security, build and infra',()=>{for(const [code,exit]of [['E_RIGHTS_DENIED',3],['E_BUILD_BUDGET',4],['E_ENVIRONMENT',5],['E_CANCELLED',130]] as const)assert.equal(exitCode({schemaVersion:'1.0.0',status:'FAIL',diagnostics:[{code,severity:'error',path:'',message:'test',remediation:'test'}],artifactPaths:[]}),exit);});
test('pre-cancelled CLI SDK returns cancellation JSON contract',async()=>{const c=new AbortController();c.abort();const r=await run(['inspect','examples/game-asset-request.json'],{signal:c.signal});assert.equal(exitCode(r),130);assert.equal(r.status,'FAIL');});
