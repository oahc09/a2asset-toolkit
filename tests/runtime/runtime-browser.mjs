// Real-engine synthetic regression. Produces stdout results, no committed reports/images.
// Supply COCOSAIR_SDK; optional A2ASSET_BROWSER, PLAYWRIGHT_PACKAGE, BROWSER_EXECUTABLE.
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {generateFixture} from './browser-fixture/generate.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const sdk=process.env.COCOSAIR_SDK;
if(!sdk)throw Error('COCOSAIR_SDK is required; engine downloads are never automatic');
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE||join(root,'package.json'));
const engines=require('playwright');
const kind=process.env.A2ASSET_BROWSER??'webkit';
if(!['webkit','chromium','firefox'].includes(kind))throw Error('Unsupported A2ASSET_BROWSER');
const engine=engines[kind],executable=process.env.BROWSER_EXECUTABLE??(kind==='webkit'?process.env.WEBKIT_EXECUTABLE:undefined);
const report={status:'BLOCKED',browser:kind,checks:[],errors:[],sdkSha256:createHash('sha256').update(await readFile(sdk)).digest('hex')};
const temp=await mkdtemp(join(tmpdir(),'a2asset-browser-test-'));
let browser,server;
try{
 await generateFixture(temp);
 const routes=new Map([['/engine/cocosair.module.js',sdk],['/runtime/index.js',join(root,'dist/src/runtime/index.js')]]);
 for(const f of ['index.html','main.mjs'])routes.set('/'+f,join(root,'tests/runtime/browser-fixture',f));
 for(const f of ['asset-manifest.json','corrupt-manifest.json','assets/atlas.png','assets/tone.wav','assets/font.woff2','assets/map.json','assets/alpha.png'])routes.set('/'+f,join(temp,f));
 server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname,p=routes.get(path==='/'?'/index.html':path);
  if(!p){res.writeHead(404);res.end();return;}
  try{res.setHeader('Content-Type',p.endsWith('.js')||p.endsWith('.mjs')?'text/javascript':p.endsWith('.json')?'application/json':p.endsWith('.png')?'image/png':p.endsWith('.wav')?'audio/wav':p.endsWith('.woff2')?'font/woff2':'text/html');res.end(await readFile(p));}catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await engine.launch({headless:true,...(executable?{executablePath:executable}:{}),...(kind==='chromium'?{chromiumSandbox:true}:{})});
 const page=await browser.newPage({viewport:{width:600,height:900}});
 page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.waitForFunction(()=>['READY','FAIL'].includes(window.__probe?.status),null,{timeout:30000});
 report.before=await page.evaluate(()=>window.__probe);
 if(report.before.status==='READY'){
  await page.click('#audio');await page.click('canvas');
  try{report.result=await page.evaluate(()=>window.__finish());}catch(e){report.result=await page.evaluate(()=>window.__probe);report.error=String(e);}
 }
 report.status=report.result?.status==='PASS'&&!report.errors.length?'PASS':'FAIL';
}catch(e){report.error=String(e);report.status=browser?'FAIL':'BLOCKED';}
finally{
 for(const cleanup of [async()=>{if(browser)await browser.close();},async()=>{if(server)await new Promise(r=>server.close(r));},async()=>{await rm(temp,{recursive:true,force:true});}]){
  try{await cleanup();}catch(e){report.errors.push('Cleanup: '+String(e));report.status='FAIL';}
 }
}
console.log(JSON.stringify(report,null,2));
if(report.status!=='PASS')process.exitCode=1;
