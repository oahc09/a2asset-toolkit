import {test} from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
// npm run build is an explicit prerequisite: test the compiled executable, not a mocked run().
const invoke=(...args:string[])=>spawnSync(process.execPath,['scripts/a2asset.mjs',...args],{encoding:'utf8',timeout:10000});
test('compiled inspect CLI emits exactly one JSON, exit 0, no interactive prompt',()=>{const p=invoke('inspect','examples/game-asset-request.json','--json','--non-interactive');assert.equal(p.status,0,p.stderr);const o=JSON.parse(p.stdout);assert.equal(o.status,'PASS');assert.equal(p.stdout.trim().split('\n').length,1);assert.equal(p.stderr,'');});
test('compiled CLI unknown options and missing files fail with exit 2 JSON',()=>{for(const args of [['inspect','--unsafe'],['inspect','missing.json']]){const p=invoke(...args);assert.equal(p.status,2,p.stderr);assert.equal(JSON.parse(p.stdout).status,'FAIL');}});
test('compiled CLI unsupported commands are explicit environment/capability exit 5',()=>{const p=invoke('cloud-generate','--json');assert.equal(p.status,5);assert.equal(JSON.parse(p.stdout).diagnostics[0].code,'E_UNSUPPORTED_COMMAND');});
