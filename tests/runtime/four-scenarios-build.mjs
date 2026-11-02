// Synthetic test approvals exist only inside the caller's disposable test registry.
// This is NOT a production asset review or benchmark acceptance record.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {importAssets} from '../../dist/src/core/import-assets.js';
import {AssetRegistry} from '../../dist/src/registry/index.js';
import {buildBundle,validatePackage} from '../../dist/src/builder/index.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const checked=r=>{assert.equal(r.status,'PASS',JSON.stringify(r.diagnostics));return r;};
function image(color){const png=new PNG({width:16,height:16});for(let i=0;i<png.data.length;i+=4)png.data.set([...color,255],i);return PNG.sync.write(png);}
function tone(){const n=4000,b=Buffer.alloc(44+n*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(500*Math.sin(i*2*Math.PI*440/8000)),44+i*2);return b;}
export async function buildFourFixtures(root){
 const registryPath=join(root,'registry'),registry=new AssetRegistry(registryPath);
 async function add(id,kind,role,sources,extra={}){
  const directory=join(root,'input',id);await mkdir(directory,{recursive:true});const files=sources.map(([path,mediaType,bytes])=>({path,mediaType,sha256:sha(bytes)}));
  for(const [path,,bytes]of sources)await writeFile(join(directory,path),bytes);
  await writeFile(join(directory,'license.txt'),'SYNTHETIC SOFTWARE TEST ONLY. Original mathematical fixture. Not production approval.');
  const definition={schemaVersion:'1.0.0',assetId:id,version:'1.0.0',kind,roles:[role],styleTags:['flat','top-down'],capabilities:{states:[]},sources:files,provenance:{origin:'procedural',sourceUrl:'https://example.invalid/synthetic-test',author:'SYNTHETIC TEST',licenseExpression:'MIT',licenseEvidencePath:'license.txt',redistributionApproved:false,reviewer:'unreviewed'},approvalStatus:'imported',...extra};
  checked(await importAssets({path:directory,definition,registry:registryPath}));
  const key=id+'@1.0.0',record=checked(registry.get(key)).record;
  const review={assetKey:key,definitionDigest:record.definitionDigest,evidenceSha256:record.files['license.txt'],reviewer:'SYNTHETIC TEST ONLY',reviewedAt:'2026-01-01T00:00:00Z',sourceUrl:definition.provenance.sourceUrl,author:'SYNTHETIC TEST',licenseExpression:'MIT',decision:'approve',redistributionApproved:true};
  checked(registry.transition(key,'approved',review));checked(registry.transition(key,'published',review));
 }
 for(const [name,color]of [['mint',[40,220,180]],['blue',[50,90,230]]])await add('test.actor.'+name,'animation2d','actor.player',[['idle.png','image/png',image(color)],['run.png','image/png',image([240,70,90])]],{capabilities:{states:['idle','run']},geometry:{pixelSize:[16,16],logicalSize:[24,24],pivot:[.5,.5]},stateFrames:{idle:{loop:true,frames:[{sourceIndex:0,durationMs:100}]},run:{loop:true,frames:[{sourceIndex:0,durationMs:100},{sourceIndex:1,durationMs:150}]}}});
 for(const [id,kind,role,color,size]of [['enemy','sprite2d','actor.enemy',[245,80,80],[16,16]],['projectile','sprite2d','projectile.player',[250,240,80],[5,9]],['background','background2d','scene.background',[20,35,55],[400,400]]])await add('test.'+id,kind,role,[[id+'.png','image/png',image(color)]],{geometry:{pixelSize:[16,16],logicalSize:size,pivot:[.5,.5]}});
 await add('test.ui','ui9slice','ui.button',[['button.png','image/png',image([180,180,180])]],{geometry:{pixelSize:[16,16],logicalSize:[100,32],pivot:[.5,.5]},nineSlice:{left:2,right:2,top:2,bottom:2}});
 await add('test.map','tilemap2d','world.ground',[['map.json','application/json',Buffer.from(JSON.stringify({width:12,height:2,tileSize:[8,8],tilesetSourceIndex:1,layers:[{name:'ground',data:Array(24).fill(0)}]}))],['tiles.png','image/png',image([160,130,80])]],{tilemap:{orientation:'orthogonal',tileSize:[8,8],layers:['ground']}});
 await add('test.hit','vfx2d','vfx.hit',[['spark-a.png','image/png',image([250,210,20])],['spark-b.png','image/png',image([230,30,200])]],{capabilities:{states:['burst']},geometry:{pixelSize:[16,16],logicalSize:[28,28],pivot:[.5,.5]},stateFrames:{burst:{loop:false,frames:[{sourceIndex:0,durationMs:80},{sourceIndex:1,durationMs:80}]}},vfx:{effectKind:'frames'}});
 await add('test.sound','audio','audio.effect',[['tone.wav','audio/wav',tone()]]);
 const slots={'enemy.main':{kind:'sprite2d',role:'actor.enemy',required:true,fallbackPolicy:'none'},'projectile.main':{kind:'sprite2d',role:'projectile.player',required:true,fallbackPolicy:'none'},'background.main':{kind:'background2d',role:'scene.background',required:true,fallbackPolicy:'none'},'vfx.hit':{kind:'vfx2d',role:'vfx.hit',required:true,requiredStates:['burst'],fallbackPolicy:'none'},'player.main':{kind:'animation2d',role:'actor.player',required:true,requiredStates:['idle','run'],fallbackPolicy:'none'},'ui.button':{kind:'ui9slice',role:'ui.button',required:true,fallbackPolicy:'none'},'map.main':{kind:'tilemap2d',role:'world.ground',required:true,fallbackPolicy:'none'},'audio.hit':{kind:'audio',role:'audio.effect',required:true,fallbackPolicy:'none'}};
 const profile={schemaVersion:'1.0.0',profileId:'synthetic-preview',target:{platform:'web',engine:'cocosairjs',renderer:'webgl2',runtimeVersion:'test'},mode:'preview',limits:{maxTextureSize:2048,maxBundleBytes:16777216,maxAtlasCount:8,maxSingleFileBytes:8388608},allowFormats:['png','json','wav'],colorSpace:'srgb',alphaMode:'straight'};
 const outputs=[];
 for(const name of ['mint','blue']){
  const themeId='test.'+name,visual={schemaVersion:'1.0.0',themeId,palette:{primary:name==='mint'?'#28DCB4':'#325AE6'},renderStyle:'flat',layout:{width:400,height:400,safeArea:[0,0,0,0]},rules:{viewAngle:'top-down',animationStyle:'frame'}};
  const ids=['test.actor.'+name,'test.ui','test.map','test.sound','test.hit','test.enemy','test.projectile','test.background'],theme={schemaVersion:'1.0.0',themeId,version:'1.0.0',visualSpecPath:'visual.json',assetIds:ids,roleBindings:{'actor.player':[ids[0]],'ui.button':['test.ui'],'world.ground':['test.map'],'audio.effect':['test.sound'],'vfx.hit':['test.hit'],'actor.enemy':['test.enemy'],'projectile.player':['test.projectile'],'scene.background':['test.background']}};
  const input={workspace:root,out:'bundles/'+name,registry,resolve:{request:{schemaVersion:'1.0.0',gameId:'synthetic.four-scenarios',genre:'arcade_shooter',slots},visual,theme,profile}};
  const first=checked(await buildBundle(input)),bytes=await readFile(join(root,input.out,'asset-manifest.json'));checked(await validatePackage(join(root,input.out),profile));
  const repeat=checked(await buildBundle(input));assert.equal(first.buildFingerprint,repeat.buildFingerprint);assert.deepEqual(await readFile(join(root,input.out,'asset-manifest.json')),bytes);assert.ok(repeat.nodes.some(n=>n.cache==='hit'));
  outputs.push({name,root:join(root,input.out),manifest:first.manifest,fingerprint:first.buildFingerprint});
 }
 return outputs;
}
