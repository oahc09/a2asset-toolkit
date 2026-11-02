// Run after npm run build. Real builder output + external pinned reference rules.
// Stdout only: no committed assets, manifests, screenshots, logs or approvals.
import {createServer} from 'node:http';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {buildFourFixtures} from './four-scenarios-build.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url))),sdk=process.env.COCOSAIR_SDK,reference=process.env.GAME_DESIGN_ROOT;
if(!sdk||!reference)throw Error('COCOSAIR_SDK and GAME_DESIGN_ROOT required; no implicit downloads');
const revision='637e383783123d97bc05b235f1a5be125a9faba1';
const git=(...args)=>execFileSync('git',['-C',reference,...args],{encoding:'utf8'}).trim();
if(git('rev-parse','HEAD')!==revision)throw Error('Reference runtime revision differs from pinned baseline');
const hash=b=>createHash('sha256').update(b).digest('hex'),routes=new Map(),logicHashes={};
for(const name of ['archetypes/falling_blocks.mjs','archetypes/match3.mjs','archetypes/arcade_shooter.mjs','core/index.mjs','core/replay.mjs','framework/task-contract.mjs']){const p='src/'+name;if(git('hash-object',p)!==git('rev-parse','HEAD:'+p))throw Error('Modified reference runtime '+name);const bytes=await readFile(join(reference,p));routes.set('/reference/'+name,bytes);logicHashes[name]=hash(bytes);}
routes.set('/engine/cocosair.module.js',await readFile(sdk));routes.set('/runtime/index.js',await readFile(join(root,'dist/src/runtime/index.js')));routes.set('/main.mjs',await readFile(join(root,'tests/runtime/four-scenarios-main.mjs')));
routes.set('/',Buffer.from('<!doctype html><meta charset="utf-8"><title>Synthetic integration test</title><style>#stage{width:400px;height:400px}canvas{width:100%;height:100%}</style><div id="stage"><canvas id="GameCanvas"></canvas></div><button id="start">Run synthetic scenarios</button><script type="importmap">{"imports":{"cocosair":"/engine/cocosair.module.js"}}</script><script type="module" src="/main.mjs"></script>'));
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||join(root,'package.json')),engines=require('playwright'),kind=process.env.A2ASSET_BROWSER??'webkit';if(!['webkit','chromium','firefox'].includes(kind))throw Error('Unsupported A2ASSET_BROWSER');const engine=engines[kind],executable=process.env.BROWSER_EXECUTABLE??(kind==='webkit'?process.env.WEBKIT_EXECUTABLE:undefined),temp=await mkdtemp(join(tmpdir(),'a2asset-four-'));
const report={status:'FAIL',browser:kind,scope:'synthetic technical integration, NOT production four-game acceptance',referenceRevision:revision,logicHashes,sdkSha256:hash(routes.get('/engine/cocosair.module.js')),errors:[]};let server,browser;
try{
 const bundles=await buildFourFixtures(temp);for(const bundle of bundles){routes.set('/bundles/'+bundle.name+'/asset-manifest.json',await readFile(join(bundle.root,'asset-manifest.json')));for(const file of bundle.manifest.files)routes.set('/bundles/'+bundle.name+'/'+file.path,await readFile(join(bundle.root,file.path)));}
 // Deliberately synthesize the old layout in memory; these are NOT historical package bytes.
 const mint=bundles.find(b=>b.name==='mint'),legacy=structuredClone(mint.manifest),removed=new Set(['reports/asset-binding.json','reports/source-refs.json']);
 legacy.files=legacy.files.filter(f=>!removed.has(f.path));
 for(const file of legacy.files){let bytes=await readFile(join(mint.root,file.path));if(file.path==='asset-lock.json'){const lock=JSON.parse(bytes.toString());lock.toolchain.a2assetVersion='0.1.0';bytes=Buffer.from(JSON.stringify(lock));file.sha256=hash(bytes);file.bytes=bytes.length;}routes.set('/bundles/legacy01-synthetic/'+file.path,bytes);}
 routes.set('/bundles/legacy01-synthetic/asset-manifest.json',Buffer.from(JSON.stringify(legacy)));
 report.legacyLayout={source:'synthetic derivation of current Builder output, not historical artifact',builderVersion:'0.1.0',manifestSchemaVersion:legacy.schemaVersion,removedReceipts:[...removed]};
 report.manifestSchemaSha256=hash(await readFile(join(root,'schemas/bundle-manifest.schema.json')));
 report.buildFingerprints=bundles.map(b=>({theme:b.name,fingerprint:b.fingerprint}));
 server=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname,bytes=routes.get(path);if(!bytes){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',path.endsWith('.mjs')||path.endsWith('.js')?'text/javascript':path.endsWith('.json')?'application/json':path.endsWith('.png')?'image/png':path.endsWith('.wav')?'audio/wav':'text/html');res.end(bytes);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await engine.launch({headless:true,...(executable?{executablePath:executable}:{}),...(kind==='chromium'?{chromiumSandbox:true}:{})});const page=await browser.newPage({viewport:{width:600,height:700}});page.on('pageerror',e=>report.errors.push(String(e)));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>['READY','FAIL'].includes(window.__four?.status),null,{timeout:30000});
 if(await page.evaluate(()=>window.__four.status)==='READY'){await page.click('canvas');await page.click('#start');while(true){await page.waitForFunction(()=>['AUDIO','PASS','FAIL'].includes(window.__four?.status),null,{timeout:60000});if(await page.evaluate(()=>window.__four.status)!=='AUDIO')break;await page.click('canvas');await page.evaluate(()=>window.__continue());}}
 report.result=await page.evaluate(()=>window.__four);report.status=report.result.status==='PASS'&&!report.errors.length?'PASS':'FAIL';
 for(const [name,sha]of Object.entries(logicHashes))if(hash(await readFile(join(reference,'src',name)))!==sha)throw Error('Logic source mutated during theme test');
}catch(e){report.error=String(e);report.status='FAIL';}finally{for(const cleanup of[async()=>{if(browser)await browser.close();},async()=>{if(server)await new Promise(r=>server.close(r));},async()=>{await rm(temp,{recursive:true,force:true});}])try{await cleanup();}catch(e){report.status='FAIL';report.errors.push('Cleanup '+String(e));}}
console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;
