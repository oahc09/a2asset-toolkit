/** Independent M0 review regressions: missing evidence must never become semantic PASS. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {validateSemantics} from '../../src/contracts/semantics.js';
const read=(name:string)=>JSON.parse(readFileSync(new URL(`../../examples/${name}.json`,import.meta.url),'utf8'));
test('review: empty declared states must not accept nonempty stateFrames',()=>{
 const root=mkdtempSync(join(tmpdir(),'a2asset-review-'));
 try {
  const bytes='bytes are only for state-map audit, not PNG decode evidence';
  writeFileSync(join(root,'sprite.png'),bytes);writeFileSync(join(root,'license.txt'),'review fixture');
  const a=read('asset-definition-UNPUBLISHABLE');
  a.sources=[{path:'sprite.png',mediaType:'image/png',sha256:createHash('sha256').update(bytes).digest('hex')}];
  a.provenance.licenseEvidencePath='license.txt';a.capabilities.states=[];
  a.stateFrames={idle:{loop:true,frames:[{sourceIndex:0,durationMs:100}]}};
  assert.notEqual(validateSemantics('asset-definition',a,{root}).status,'PASS');
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('review: self-inheriting theme must be rejected or explicitly blocked',()=>{
 const theme=read('theme-pack');theme.inherits=[theme.themeId];
 assert.notEqual(validateSemantics('theme-pack',theme).status,'PASS');
});
test('review: unverified production empty manifest cannot be certified',()=>{
 const m=read('bundle-manifest-SCHEMA_ONLY');m.bindings={};m.files=[];delete m.licenseNoticePath;
 assert.notEqual(validateSemantics('bundle-manifest',m,{mode:'Production'}).status,'PASS');
});
test('review: asset-binding with no registry/request context cannot receive complete semantic PASS',()=>{
 const b=read('asset-binding-SCHEMA_ONLY');
 assert.notEqual(validateSemantics('asset-binding',b,{mode:'Production'}).status,'PASS');
});
