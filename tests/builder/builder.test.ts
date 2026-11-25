import {PNG} from 'pngjs';
import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,readFileSync,rmSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
import {AssetRegistry,canonical,type ReviewRecord} from '../../src/registry/index.js';import {buildBundle,validatePackage,type BuildInput} from '../../src/builder/index.js';
const read=(name:string)=>JSON.parse(readFileSync(`examples/${name}.json`,'utf8'));const sha=(x:Uint8Array)=>createHash('sha256').update(x).digest('hex');
function fixture(root:string,variant=false,sourceBytes?:Buffer):BuildInput{const registry=new AssetRegistry(join(root,'registry')),d=read('asset-definition-UNPUBLISHABLE'),bytes=sourceBytes??readFileSync('examples/m0-runtime/assets/player.png');d.approvalStatus='imported';d.geometry.pixelSize=[32,32];d.capabilities.states=['idle'];d.stateFrames={idle:{loop:true,frames:[{sourceIndex:0,durationMs:100}]}};d.sources=[{path:'sprite.png',sha256:sha(bytes),mediaType:'image/png',width:32,height:32}];d.provenance.licenseEvidencePath='license.txt';const variantImage=PNG.sync.read(readFileSync('examples/m0-runtime/assets/player.png'));for(let n=0;n<variantImage.data.length;n+=4)if(variantImage.data[n+3]){variantImage.data[n]=255;variantImage.data[n+1]=0;variantImage.data[n+2]=0;}const variantBytes=PNG.sync.write(variantImage);if(variant)d.variants=[{variantId:'web-copy',target:'web',path:'alternate.png',sha256:sha(variantBytes),mediaType:'image/png'}];assert.equal(registry.importDefinition(d,new Map([['sprite.png',bytes],['license.txt',Buffer.from('SYNTHETIC SOFTWARE TEST; NOT REAL PRODUCTION APPROVAL')],...(variant?[['alternate.png',variantBytes] as [string,Buffer]]:[])])).status,'PASS');const key=d.assetId+'@'+d.version;registry.transition(key,'inspected');const e=registry.get(key).record!;const review:ReviewRecord={assetKey:key,definitionDigest:e.definitionDigest,evidenceSha256:e.files['license.txt'],reviewer:'SYNTHETIC TEST',reviewedAt:'2026-01-01T00:00:00Z',sourceUrl:'https://example.invalid/test',author:'TEST',licenseExpression:'MIT',decision:'approve',redistributionApproved:true};registry.transition(key,'approved',review);registry.transition(key,'published',review);return {workspace:root,out:'output',registry,resolve:{request:{schemaVersion:'1.0.0',gameId:'test.game',genre:'arcade_shooter',slots:{'player.main':{kind:'sprite2d',role:'actor.player',required:true,requiredStates:['idle'],fallbackPolicy:'none'}}},visual:read('visual-spec'),profile:read('build-profile')}};}
async function scenario(fn:(root:string,i:BuildInput)=>Promise<void>){const root=mkdtempSync(join(tmpdir(),'a2asset-build-test-'));try{await fn(root,fixture(root));}finally{rmSync(root,{recursive:true,force:true});}}
test('synthetic software build: actual PNG/manifest/lock/notices validates and repeats byte-identically with cache hit',()=>scenario(async(root,i)=>{const a=await buildBundle(i);assert.equal(a.status,'PASS',JSON.stringify(a.diagnostics));assert.equal((await validatePackage(join(root,'output'))).status,'PASS');const first=readFileSync(join(root,'output/asset-manifest.json'));const b=await buildBundle(i);assert.equal(b.status,'PASS',JSON.stringify(b.diagnostics));assert.deepEqual(readFileSync(join(root,'output/asset-manifest.json')),first);assert.ok(b.nodes.some(n=>n.cache==='hit'));assert.equal(a.buildFingerprint,b.buildFingerprint);assert.ok(a.nodes.every(n=>n.status==='PASS'&&Array.isArray(n.diagnostics)&&n.diagnostics.length===0&&n.retryable===false&&n.elapsedMs>=0));assert.ok(readFileSync(join(root,'output/NOTICES.txt'),'utf8').includes('License: MIT'));}));
test('corrupt cache fails and preserves previously successful package',()=>scenario(async(root,i)=>{assert.equal((await buildBundle(i)).status,'PASS');const previous=readFileSync(join(root,'output/asset-manifest.json'));const cache=join(root,'.a2asset-cache',readdirSync(join(root,'.a2asset-cache'))[0]);writeFileSync(cache,'{}');const r=await buildBundle(i);assert.equal(r.status,'FAIL');const failed=r.nodes.at(-1)!;assert.equal(failed.id,'process:ships.blue-falcon@1.0.0');assert.equal(failed.status,'FAIL');assert.equal(failed.retryable,false);assert.deepEqual(failed.diagnostics,r.diagnostics);assert.match(failed.inputDigest,/^[a-f0-9]{64}$/);assert.deepEqual(readFileSync(join(root,'output/asset-manifest.json')),previous);}));
test('revoked approval cannot reuse cached published result',()=>scenario(async(root,i)=>{assert.equal((await buildBundle(i)).status,'PASS');i.registry.transition('ships.blue-falcon@1.0.0','deprecated');const r=await buildBundle(i);assert.equal(r.status,'FAIL');assert.ok(r.diagnostics.some(d=>d.code==='E_RESOLVE_MISSING'));assert.equal(r.nodes.at(-1)?.id,'ValidateInputsResolvePlan');assert.equal(r.nodes.at(-1)?.retryable,false);}));
test('budget failure and cancellation do not publish or delete unrelated output',()=>scenario(async(root,i)=>{i.resolve.profile.limits.maxBundleBytes=1024;assert.equal((await buildBundle(i)).status,'FAIL');const c=new AbortController();c.abort();i.signal=c.signal;assert.equal((await buildBundle(i)).diagnostics[0].code,'E_CANCELLED');}));
test('outside workspace and unknown existing directory are refused',()=>scenario(async(root,i)=>{i.out='../escape';assert.equal((await buildBundle(i)).status,'FAIL');i.out='output';mkdirSync(join(root,'output'));writeFileSync(join(root,'output','user-file.txt'),'keep');assert.equal((await buildBundle(i)).status,'FAIL');assert.equal(readFileSync(join(root,'output','user-file.txt'),'utf8'),'keep');}));
test('manifest tamper / unlisted package file fails validation',()=>scenario(async(root,i)=>{assert.equal((await buildBundle(i)).status,'PASS');writeFileSync(join(root,'output','unexpected.txt'),'unlisted');assert.equal((await validatePackage(join(root,'output'))).status,'FAIL');}));

test('explicit raster variant is processed and pinned, not silently replaced by original source',async()=>{const root=mkdtempSync(join(tmpdir(),'a2asset-variant-'));try{const i=fixture(root,true);i.resolve.bindings={schemaVersion:'1.0.0',gameId:'test.game',bindings:{'player.main':{assetId:'ships.blue-falcon',version:'1.0.0',variantId:'web-copy'}}};const r=await buildBundle(i);assert.equal(r.status,'PASS',JSON.stringify(r.diagnostics));assert.equal(r.lock!.entries['player.main'].variantId,'web-copy');assert.equal(r.lock!.entries['player.main'].sourceHashes.length,2);assert.ok(r.manifest!.bindings['player.main'].files[0].includes('.v-'));assert.equal(r.manifest!.bindings['player.main'].assetId,'ships.blue-falcon');const image=PNG.sync.read(readFileSync(join(root,'output',r.manifest!.bindings['player.main'].files[0])));let colored=false;for(let n=0;n<image.data.length;n+=4)if(image.data[n+3]){assert.equal(image.data[n],255);assert.equal(image.data[n+1],0);colored=true;}assert.ok(colored);}finally{rmSync(root,{recursive:true,force:true});}});
test('incremental rebuild changes one sprite without reprocessing unrelated audio',()=>scenario(async(root,i)=>{
 const base=i.registry.get('ships.blue-falcon@1.0.0').record!.definition;
 const publish=(d:any,bytes:Buffer)=>{d.approvalStatus='imported';d.provenance.licenseEvidencePath='license.txt';assert.equal(i.registry.importDefinition(d,new Map([[d.sources[0].path,bytes],['license.txt',Buffer.from('SYNTHETIC SOFTWARE TEST; NOT REAL PRODUCTION APPROVAL')]])).status,'PASS');const key=d.assetId+'@'+d.version;i.registry.transition(key,'inspected');const e=i.registry.get(key).record!;const review:ReviewRecord={assetKey:key,definitionDigest:e.definitionDigest,evidenceSha256:e.files['license.txt'],reviewer:'SYNTHETIC TEST',reviewedAt:'2026-01-01T00:00:00Z',sourceUrl:'https://example.invalid/test',author:'TEST',licenseExpression:'MIT',decision:'approve',redistributionApproved:true};assert.equal(i.registry.transition(key,'approved',review).status,'PASS');assert.equal(i.registry.transition(key,'published',review).status,'PASS');};
 const wav=Buffer.alloc(44+160);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(160,40);
 const audio=structuredClone(base);audio.assetId='music.test';audio.kind='audio';audio.roles=['audio.music'];audio.capabilities={};delete audio.stateFrames;delete audio.geometry;audio.sources=[{path:'music.wav',mediaType:'audio/wav',sha256:sha(wav)}];publish(audio,wav);
 i.resolve.request.slots['music.main']={kind:'audio',role:'audio.music',required:true,fallbackPolicy:'none'};
 i.resolve.bindings={schemaVersion:'1.0.0',gameId:'test.game',bindings:{'player.main':{assetId:'ships.blue-falcon',version:'1.0.0'},'music.main':{assetId:'music.test',version:'1.0.0'}}};
 const first=await buildBundle(i);assert.equal(first.status,'PASS',JSON.stringify(first.diagnostics));assert.equal(first.nodes.find(n=>n.id==='process:music.test@1.0.0')!.cache,'miss');
 const sprite=structuredClone(base);sprite.version='1.0.1';const image=PNG.sync.read(readFileSync('examples/m0-runtime/assets/player.png'));image.data[0]=123;const changed=PNG.sync.write(image);sprite.sources=[{path:'sprite.png',mediaType:'image/png',sha256:sha(changed)}];publish(sprite,changed);i.resolve.bindings!.bindings['player.main'].version='1.0.1';
 const second=await buildBundle(i);assert.equal(second.status,'PASS',JSON.stringify(second.diagnostics));assert.equal(second.nodes.find(n=>n.id==='process:music.test@1.0.0')!.cache,'hit');assert.equal(second.nodes.find(n=>n.id==='process:ships.blue-falcon@1.0.1')!.cache,'miss');assert.notEqual(first.buildFingerprint,second.buildFingerprint);
}));
test('late cancellation during final registry recheck preserves old bundle and cleans staging',()=>scenario(async(root,i)=>{
 assert.equal((await buildBundle(i)).status,'PASS');const previous=readFileSync(join(root,'output/asset-manifest.json'));const c=new AbortController();i.signal=c.signal;
 const list=i.registry.list.bind(i.registry);let calls=0;i.registry.list=((...args:any[])=>{const result=list(args[0]);if(++calls===2)c.abort();return result;}) as typeof i.registry.list;
 const result=await buildBundle(i);assert.equal(result.status,'FAIL');assert.equal(result.diagnostics[0]?.code,'E_CANCELLED');assert.deepEqual(readFileSync(join(root,'output/asset-manifest.json')),previous);assert.equal(readdirSync(root).some(n=>n.includes('.staging-')||n.includes('.previous-')),false);
}));

test('busy output lock records a retryable failed DAG node without claiming successful processing',()=>scenario(async(root,i)=>{mkdirSync(join(root,'output.writer-lock'));const result=await buildBundle(i);assert.equal(result.status,'FAIL');assert.equal(result.nodes.length,1);assert.equal(result.nodes[0].id,'ValidateInputs');assert.equal(result.nodes[0].retryable,true);assert.equal(result.nodes[0].diagnostics[0].code,'E_REGISTRY_BUSY');}));

function pngMetadata(input:Buffer,type:string,data:Buffer,afterIhdr=true){
 const chunk=Buffer.alloc(12+data.length);chunk.writeUInt32BE(data.length);chunk.write(type,4,'ascii');data.copy(chunk,8);
 // PNG CRC-32 using a nibble lookup, independent of production's bitwise scanner.
 const table=[0,0x1db71064,0x3b6e20c8,0x26d930ac,0x76dc4190,0x6b6b51f4,0x4db26158,0x5005713c,0xedb88320,0xf00f9344,0xd6d6a3e8,0xcb61b38c,0x9b64c2b0,0x86d3d2d4,0xa00ae278,0xbdbdf21c];
 let crc=0xffffffff;for(const byte of chunk.subarray(4,-4)){crc^=byte;crc=(crc>>>4)^table[crc&15];crc=(crc>>>4)^table[crc&15];}
 chunk.writeUInt32BE((crc^0xffffffff)>>>0,chunk.length-4);
 const off=afterIhdr?33:input.length-12;return Buffer.concat([input.subarray(0,off),chunk,input.subarray(off)]);
}
const pngWords=(...values:number[])=>{const bytes=Buffer.alloc(values.length*4);values.forEach((v,i)=>bytes.writeUInt32BE(v,i*4));return bytes;};
const pngSrgbChrm=pngWords(31270,32900,64000,33000,30000,60000,15000,6000);
test('PNG admission is identical on cold and cached builds even with a matching persisted receipt',async()=>{
 const root=mkdtempSync(join(tmpdir(),'a2asset-png-admission-'));
 try{
  const generated=new PNG({width:32,height:32});for(let offset=0;offset<generated.data.length;offset+=4)generated.data.set([100,36,18,255],offset);
  const png=PNG.sync.write(generated);
  const explicit=pngMetadata(pngMetadata(pngMetadata(png,'sRGB',Buffer.from([0])),'gAMA',pngWords(45455)),'cHRM',pngSrgbChrm);
  let cacheTemplate:any;
  let artifact:Buffer|undefined;
  for(const [name,source] of [['untagged',png],['sRGB with canonical cHRM/gAMA',explicit]] as const){
   const dir=mkdtempSync(join(root,'allow-'));const i=fixture(dir,false,source);
   const cold=await buildBundle(i),warm=await buildBundle(i);assert.equal(cold.status,'PASS',name);assert.equal(warm.status,'PASS',name);
   const node=cold.nodes.find(n=>n.id.startsWith('process:'))!;
   assert.equal(node.cache,'miss');assert.equal(warm.nodes.find(n=>n.id===node.id)?.cache,'hit');
   assert.deepEqual(cold.manifest,warm.manifest);
   const output=readFileSync(join(dir,i.out,cold.manifest!.bindings['player.main'].files[0]));if(artifact)assert.deepEqual(output,artifact);artifact=output;
   cacheTemplate=JSON.parse(readFileSync(join(dir,'.a2asset-cache',node.inputDigest+'.json'),'utf8'));
  }
  const overriddenGamma=pngMetadata(pngMetadata(png,'sRGB',Buffer.from([0])),'gAMA',pngWords(100000));
  const nonSrgbChrm=pngMetadata(pngMetadata(png,'sRGB',Buffer.from([0])),'cHRM',pngWords(31270,32900,68000,32000,26500,69000,15000,6000));
  const badCrc=pngMetadata(png,'cHRM',pngSrgbChrm);badCrc[76]^=1;
  for(const [name,source,code] of [
   ['P3 cICP before fallback',pngMetadata(explicit,'cICP',Buffer.from([12,13,0,1])),'E_PROCESSOR_UNSUPPORTED'],
   ['noncanonical tagged gamma',overriddenGamma,'E_PROCESSOR_UNSUPPORTED'],
   ['non-sRGB tagged cHRM',nonSrgbChrm,'E_PROCESSOR_UNSUPPORTED'],
   ['untagged non-sRGB cHRM',pngMetadata(png,'cHRM',pngWords(31270,32900,68000,32000,26500,69000,15000,6000)),'E_PROCESSOR_UNSUPPORTED'],
   ['zero gamma',pngMetadata(png,'gAMA',pngWords(0)),'E_SECURITY_UNSAFE_CONTENT'],
   ['malformed cHRM size',pngMetadata(png,'cHRM',pngWords(31270)),'E_SECURITY_UNSAFE_CONTENT'],
   ['late cHRM',pngMetadata(png,'cHRM',pngSrgbChrm,false),'E_SECURITY_UNSAFE_CONTENT'],
   ['bad cHRM CRC',badCrc,'E_SECURITY_UNSAFE_CONTENT'],
   ['duplicate gAMA',pngMetadata(explicit,'gAMA',pngWords(45455)),'E_SECURITY_UNSAFE_CONTENT'],
  ] as const){
   const dir=mkdtempSync(join(root,'refuse-'));const i=fixture(dir,false,source);
   const cold=await buildBundle(i);assert.equal(cold.status,'FAIL',name);assert.equal(cold.diagnostics[0]?.code,code,name);
   const node=cold.nodes.at(-1)!;assert.match(node.id,/^process:/);
   assert.deepEqual(readdirSync(join(dir,'.a2asset-cache')),[],name);
   // Model a persisted product/receipt pair with the current input key and matching digests.
   const seeded=Buffer.from(canonical({...cacheTemplate,key:node.inputDigest})+'\n');
   writeFileSync(join(dir,'.a2asset-cache',node.inputDigest+'.json'),seeded);
   writeFileSync(join(dir,'.a2asset-build-receipts',node.inputDigest+'.sha256'),sha(seeded));
   const warm=await buildBundle(i);assert.equal(warm.status,'FAIL',name);assert.equal(warm.diagnostics[0]?.code,code,name);
   assert.equal(warm.nodes.at(-1)?.inputDigest,node.inputDigest,name);assert.equal(readdirSync(dir).includes(i.out),false,name);
  }
 }finally{rmSync(root,{recursive:true,force:true});}
});
