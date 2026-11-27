// Local-only server: exposes only this M0 example, the named fixture and pinned SDK file.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const root=resolve(new URL('..',import.meta.url).pathname);
const sdk=process.env.COCOSAIR_SDK;
if(!sdk) throw new Error('COCOSAIR_SDK must name the pinned cocosair.module.js');
const require=createRequire(process.env.PLAYWRIGHT_PACKAGE || resolve(root,'package.json'));
const {webkit}=require('playwright');
const routes=new Map([['/engine/cocosair.module.js',resolve(sdk)],['/fixtures/game-specs/arcade_shooter.json',resolve(root,'fixtures/game-specs/arcade_shooter.json')]]);
for(const f of ['index.html','main.mjs','manifest-check.mjs','asset-manifest.json','assets/player.png'])routes.set('/'+f,resolve(root,'examples/m0-runtime',f));
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;const file=routes.get(path==='/'?'/index.html':path);if(!file){res.writeHead(404);res.end();return;}try{const data=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.png')?'image/png':'text/html');res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const out=resolve(root,process.env.M0_EVIDENCE_DIR||'evidence/m0-runtime');await mkdir(out,{recursive:true});
const sourceHashes={};for(const f of ['examples/m0-runtime/main.mjs','examples/m0-runtime/manifest-check.mjs','examples/m0-runtime/asset-manifest.json','fixtures/game-specs/arcade_shooter.json','scripts/m0-runtime-browser.mjs'])sourceHashes[f]=createHash('sha256').update(await readFile(resolve(root,f))).digest('hex');
let browser;const report={timestamp:new Date().toISOString(),sdkSha256:createHash('sha256').update(await readFile(sdk)).digest('hex'),status:'BLOCKED',sourceHashes,consoleErrors:[]};
try{
 browser=await webkit.launch({headless:true,...(process.env.WEBKIT_EXECUTABLE?{executablePath:process.env.WEBKIT_EXECUTABLE}:{})});
 const page=await browser.newPage({viewport:{width:600,height:800}});page.on('pageerror',e=>report.consoleErrors.push(String(e)));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>['PASS','FAIL'].includes(window.__m0?.status),{timeout:30000});report.result=await page.evaluate(()=>window.__m0);await page.screenshot({path:resolve(out,'loaded.png')});
 if(report.result.status==='PASS')report.disposal=await page.evaluate(()=>window.__disposeM0());
 report.status=report.result.status==='PASS'&&report.disposal?.released&&!report.consoleErrors.length?'PASS':'FAIL';
}catch(e){report.error=String(e.stack||e);}finally{if(browser){try{await browser.close();report.browserClosed=true;}catch(e){report.browserClosed=false;report.closeError=String(e);}}await new Promise(r=>server.close(r));await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;
