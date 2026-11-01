import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,readFileSync,rmSync,symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateSemantics } from '../../src/contracts/semantics.js';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const asset=JSON.parse(readFileSync(new URL('../../examples/asset-definition-UNPUBLISHABLE.json',import.meta.url),'utf8'));
test('schema-only negative asset cannot be production published',()=>assert.equal(validateSemantics('asset-definition',asset,{mode:'Production'}).status,'FAIL'));
for(const mutation of ['hash','source-index','missing-state','no-rights','symlink','case-collision'] as const)test(`actual-byte safety: ${mutation}`,()=>{
 const root=mkdtempSync(join(tmpdir(),'a2asset-contract-'));
 try {
  writeFileSync(join(root,'sprite.png'),'fixture bytes');writeFileSync(join(root,'license.txt'),'MIT audit fixture; not artwork approval');
  const a=structuredClone(asset);a.sources=[{path:'sprite.png',sha256:sha('fixture bytes'),mediaType:'image/png'}];a.provenance.licenseEvidencePath='license.txt';a.capabilities.states=['idle'];a.stateFrames={idle:{loop:true,frames:[{sourceIndex:0,durationMs:100}]}};
  assert.equal(validateSemantics('asset-definition',a,{root}).status,'PASS');
  if(mutation==='hash')a.sources[0].sha256='0'.repeat(64);
  if(mutation==='source-index')a.stateFrames.idle.frames[0].sourceIndex=1;
  if(mutation==='missing-state')a.capabilities.states.push('destroyed');
  if(mutation==='no-rights')a.approvalStatus='published';
  if(mutation==='symlink'){symlinkSync('sprite.png',join(root,'link.png'));a.sources[0].path='link.png';}
  if(mutation==='case-collision'){writeFileSync(join(root,'Sprite.png'),'fixture bytes');a.sources.push({...a.sources[0],path:'Sprite.png'});}
  assert.equal(validateSemantics('asset-definition',a,{root}).status,'FAIL');
 }finally{rmSync(root,{recursive:true,force:true});}
});
