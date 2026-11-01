import {test} from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
test('synthetic-only integration: import→explicit review→publish→deprecate',()=>{
 const temp=mkdtempSync(join(tmpdir(),'a2asset-synthetic-lifecycle-')),source=join(temp,'source'),registry=join(temp,'registry');mkdirSync(source);
 try{
 const bytes=readFileSync('examples/m0-runtime/assets/player.png');writeFileSync(join(source,'player.png'),bytes);writeFileSync(join(source,'license.txt'),'SYNTHETIC UNIT TEST EVIDENCE. NOT PRODUCTION APPROVAL.');
 const d=JSON.parse(readFileSync('examples/asset-definition-UNPUBLISHABLE.json','utf8'));d.sources=[{path:'player.png',sha256:sha(bytes),mediaType:'image/png'}];d.provenance.licenseEvidencePath='license.txt';d.capabilities.states=['idle'];d.stateFrames={idle:{loop:true,frames:[{sourceIndex:0,durationMs:100}]}};d.approvalStatus='imported';d.geometry.pixelSize=[32,32];writeFileSync(join(source,'definition.json'),JSON.stringify(d));
 const executable=resolve('scripts/a2asset.mjs');const call=(...args:string[])=>{const p=spawnSync(process.execPath,[executable,...args,'--json','--non-interactive'],{cwd:temp,encoding:'utf8',timeout:10000});assert.equal(p.status,0,p.stdout+p.stderr);return JSON.parse(p.stdout);};
 const imported=call('import',source,'--definition',join(source,'definition.json'),'--registry',registry);
 const review={assetKey:imported.assetKey,definitionDigest:imported.record.definitionDigest,evidenceSha256:imported.record.files['license.txt'],reviewer:'SYNTHETIC TEST REVIEWER',reviewedAt:'2026-01-01T00:00:00Z',sourceUrl:'https://example.invalid/synthetic-test-only',author:'SYNTHETIC TEST AUTHOR',licenseExpression:'MIT',redistributionApproved:true,decision:'approve',notes:'Synthetic software state-machine test, not real production rights approval'};
 const path=join(temp,'synthetic-review.json');writeFileSync(path,JSON.stringify(review));
 for(const [action,state]of [['approve','approved'],['publish','published']] as const)assert.equal(call('registry',action,imported.assetKey,'--review-record',path,'--registry',registry).record.state,state);
 const request={schemaVersion:'1.0.0',gameId:'test.game',genre:'arcade_shooter',slots:{'player.main':{kind:'sprite2d',role:'actor.player',required:true,requiredStates:['idle'],fallbackPolicy:'none'}}};writeFileSync(join(temp,'request.json'),JSON.stringify(request));writeFileSync(join(temp,'visual.json'),readFileSync('examples/visual-spec.json'));writeFileSync(join(temp,'profile.json'),readFileSync('examples/build-profile.json'));
 const shared=['request.json','--registry',registry,'--visual','visual.json','--profile','profile.json'];
 assert.equal(call('resolve',...shared,'--out','bindings.json').status,'PASS');
 const built=call('build',...shared,'--bindings','bindings.json','--out','output');assert.equal(built.status,'PASS');assert.equal(call('validate','output').status,'PASS');
 assert.equal(call('registry','deprecate',imported.assetKey,'--registry',registry).record.state,'deprecated');
 }finally{rmSync(temp,{recursive:true,force:true});}
});
