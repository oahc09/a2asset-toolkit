import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildFourFixtures} from './four-scenarios-build.mjs';
// Requires npm run build. No engine/browser dependency for this pipeline test.
test('synthetic importer/review/builder emits two actual reproducible themed packages',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'a2asset-four-build-test-'));
 try{const bundles=await buildFourFixtures(temp);assert.equal(bundles.length,2);assert.notEqual(bundles[0].fingerprint,bundles[1].fingerprint);for(const b of bundles){assert.equal(Object.keys(b.manifest.bindings).length,8);assert.ok(b.manifest.bindings['player.main'].stateClips.run.frames.length===2);assert.equal(b.manifest.bindings['vfx.hit'].stateClips.burst.frames.length,2);assert.equal(b.manifest.bindings['map.main'].tilemap.orientation,'orthogonal');assert.ok((await readdir(b.root)).includes('asset-lock.json'));}}
 finally{await rm(temp,{recursive:true,force:true});}
});
