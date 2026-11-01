import {test} from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
test('compiled CLI imports actual PNG, lists inspected asset, refuses approval without human record',()=>{
 const temp=mkdtempSync(join(tmpdir(),'a2asset-cli-')),source=join(temp,'source'),registry=join(temp,'registry');mkdirSync(source);
 try {
  const bytes=readFileSync('examples/m0-runtime/assets/player.png');writeFileSync(join(source,'player.png'),bytes);writeFileSync(join(source,'license.txt'),'Synthetic testing only. No production human approval.');
  const d=JSON.parse(readFileSync('examples/asset-definition-UNPUBLISHABLE.json','utf8'));d.sources=[{path:'player.png',sha256:sha(bytes),mediaType:'image/png'}];d.provenance.licenseEvidencePath='license.txt';d.capabilities.states=['idle'];d.stateFrames={idle:{loop:true,frames:[{sourceIndex:0,durationMs:100}]}};d.approvalStatus='imported';d.geometry.pixelSize=[32,32];writeFileSync(join(source,'definition.json'),JSON.stringify(d));
  const call=(...args:string[])=>spawnSync(process.execPath,['scripts/a2asset.mjs',...args,'--json','--non-interactive'],{encoding:'utf8',timeout:10000});
  const p=call('import',source,'--definition',join(source,'definition.json'),'--registry',registry);assert.equal(p.status,0,p.stdout+p.stderr);const result=JSON.parse(p.stdout);assert.equal(result.record.state,'inspected');
  const list=call('registry','list','--registry',registry);assert.equal(list.status,0,list.stdout);assert.equal(JSON.parse(list.stdout).records.length,1);
  for(const action of ['approve','publish']){const refused=call('registry',action,result.assetKey,'--registry',registry);assert.equal(refused.status,3,refused.stdout);assert.equal(JSON.parse(refused.stdout).status,'FAIL');}
  assert.deepEqual(readFileSync(join(source,'player.png')),bytes);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
