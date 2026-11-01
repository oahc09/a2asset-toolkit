import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
test('compiled SIGINT produces JSON exit 130 after importer worker cleanup',async()=>{
 const temp=mkdtempSync(join(tmpdir(),'a2asset-cli-cancel-')),source=join(temp,'source');mkdirSync(source);
 try{
  const png=readFileSync('examples/m0-runtime/assets/player.png');for(let i=0;i<128;i++)writeFileSync(join(source,`image-${i}.png`),png);
  const d=JSON.parse(readFileSync('examples/asset-definition-UNPUBLISHABLE.json','utf8'));writeFileSync(join(temp,'definition.json'),JSON.stringify(d));
  const child=spawn(process.execPath,['scripts/a2asset.mjs','import',source,'--definition',join(temp,'definition.json'),'--registry',join(temp,'registry'),'--json'],{stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  const signal=setTimeout(()=>child.kill('SIGINT'),800);const watchdog=setTimeout(()=>child.kill('SIGTERM'),12000);
  const code=await new Promise<number|null>((res,rej)=>{child.on('error',rej);child.on('close',res);});clearTimeout(signal);clearTimeout(watchdog);
  assert.equal(code,130,stdout+stderr);assert.equal(JSON.parse(stdout).diagnostics[0].code,'E_CANCELLED');
 }finally{rmSync(temp,{recursive:true,force:true});}
});
