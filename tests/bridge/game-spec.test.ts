import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {ARCHETYPES, mapGameSpec, SOURCE_REVISION, type SourceValidator} from '../../src/bridge/game-spec.js';
import {validateContract} from '../../src/contracts/validate.js';
const fixture = async (name: string) => JSON.parse(await readFile(new URL(`../../fixtures/game-specs/${name}.json`, import.meta.url),'utf8'));
// Unit seam stub: this verifies mapping mechanics, NOT upstream gameplay validity.
const accepted: SourceValidator = () => ({status:'PASS',issues:[]});
for (const name of ARCHETYPES) test(`${name}: frozen mapping, output schema, deterministic and input immutable`, async () => {
 const source = await fixture(name), before = JSON.stringify(source);
 const first = mapGameSpec(source, accepted);
 assert.equal(first.status,'PASS');
 assert.equal(validateContract('game-asset-request',first.request).status,'PASS');
 assert.deepEqual(first,mapGameSpec(source,accepted));
 assert.equal(JSON.stringify(source),before);
 const expected = JSON.parse(await readFile(new URL(`../../fixtures/game-requests/${name}.json`,import.meta.url),'utf8'));
 assert.deepEqual(first.request,expected);
 assert.ok(Object.values(first.request!.slots).every(s=>s.requiredStates.join()==='idle'&&s.fallbackPolicy==='none'));
});
test('unknown archetypes and custom capabilities fail explicitly', async()=>{
 const s=await fixture('sokoban'); s.game.archetype='platformer';
 assert.equal(mapGameSpec(s,accepted).diagnostics[0]?.code,'E_UNSUPPORTED_CAPABILITY');
 const x=await fixture('sokoban'); x.extensions={custom:{}};
 assert.equal(mapGameSpec(x,accepted).status,'FAIL');
 const y=await fixture('sokoban'); y.content.extensions.custom={};
 assert.equal(mapGameSpec(y,accepted).status,'FAIL');
});
test('invalid identifiers, version, archetype mismatch and absent validation fail',async()=>{
 for(const change of [(s:any)=>s.metadata.id='../secret',(s:any)=>s.schema_version='9',(s:any)=>s.content.archetype='match3']) {
  const s=await fixture('sokoban'); change(s); assert.equal(mapGameSpec(s,accepted).status,'FAIL');
 }
 const source=await fixture('sokoban');
 assert.equal(mapGameSpec(source,undefined as unknown as SourceValidator).status,'FAIL');
 assert.equal(mapGameSpec(source,()=>({status:'FAIL'})).status,'FAIL');
 assert.equal(mapGameSpec(source,()=>({status:'PASS',issues:[{code:'broken'}]})).status,'FAIL');
 assert.equal(mapGameSpec(source,()=>{throw Error('infra');}).status,'FAIL');
});
test('validator cannot mutate original source, outputs have no shared mutable mapping',async()=>{
 const source=await fixture('sokoban'), before=JSON.stringify(source);
 const result=mapGameSpec(source,(copy:any)=>{copy.content={};return {status:'PASS'};});
 assert.equal(JSON.stringify(source),before);
 result.request!.slots['player.main']!.role='edited';
 assert.equal(mapGameSpec(source,accepted).request!.slots['player.main']!.role,'actor.player');
});
test('content-dependent refill colors, blockers and enemy bullets',async()=>{
 const match=await fixture('match3'); match.content.extensions.match3.colors=5;
 match.content.extensions.match3.blockers=[[1]];
 const r=mapGameSpec(match,accepted); assert.ok(r.request!.slots['gem.color-4']); assert.ok(r.request!.slots['board.blocker']);
 match.content.extensions.match3.colors=1e9; assert.equal(mapGameSpec(match,accepted).status,'FAIL');
 const shooter=await fixture('arcade_shooter');shooter.content.extensions.arcade_shooter.enemyFireIntervalTicks=0;
 assert.equal(mapGameSpec(shooter,accepted).request!.slots['bullet.enemy'],undefined);
});
test('pinned upstream validator accepts all six immutable fixtures and rejects gameplay damage', {skip:!process.env.GAME_DESIGN_ROOT}, async()=>{
 const root=resolve(process.env.GAME_DESIGN_ROOT!);
 const {execFileSync}=await import('node:child_process');
 assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),SOURCE_REVISION);
 const {validateSpec}=await import(pathToFileURL(resolve(root,'src/core/validate.mjs')).href);
 const {registry}=await import(pathToFileURL(resolve(root,'src/archetypes/index.mjs')).href);
 const validator: SourceValidator = spec=>validateSpec(spec,registry);
 for(const name of ARCHETYPES){const s=await fixture(name); assert.equal(mapGameSpec(s,validator).status,'PASS');s.action_space={type:'invalid'};assert.equal(mapGameSpec(s,validator).status,'FAIL');}
});
