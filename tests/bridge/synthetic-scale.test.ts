/** Synthetic engineering load regression only: NOT a survey of 50 real games,
 * production acceptance, runtime playthrough, or an approved artwork catalogue.
 * All variants exist only in memory; no experiment configs/results are published. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {ARCHETYPES,mapGameSpec,SOURCE_REVISION,type SourceValidator} from '../../src/bridge/game-spec.js';import {validateContract} from '../../src/contracts/validate.js';import {summarizeCoverage} from '../../src/quality/index.js';import {resolveAssets} from '../../src/resolver/index.js';
const json=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
function canonical(value:any):string{return value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';}
function variant(archetype:string,index:number){const spec=json(`fixtures/game-specs/${archetype}.json`);spec.metadata.id=`synthetic-${archetype.replaceAll('_','-')}-${index}`;const c=spec.content.extensions[archetype];
 switch(archetype){
  case 'sokoban':{const row='#@$'+' '.repeat(index)+'.#';c.map=['#'.repeat(row.length),row,'#'.repeat(row.length)];c.maxMoves=20+index;break;}
  case 'match3':c.objectives=[{type:'score',target:100+25*index}];break;
  case 'merge2048':c.target=2**(index+3);break;
  case 'block_puzzle':c.targetLines=index+1;break;
  case 'falling_blocks':c.targetLines=index+1;break;
  case 'arcade_shooter':c.enemies[0].x=10+3*index;c.enemyFireIntervalTicks=index%2?0:100;break;
  default:throw Error('Unsupported synthetic generator');
 }
 return spec;
}
test('50 content-distinct synthetic variants use actual pinned validator and honest missing-asset statistics',{skip:!process.env.GAME_DESIGN_ROOT?'BLOCKED: GAME_DESIGN_ROOT not provided; never substitute a mock validator.':false},async()=>{
 const root=resolve(process.env.GAME_DESIGN_ROOT!);assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),SOURCE_REVISION,'Actual source revision must match audited bridge');
 const {validateSpec}=await import(pathToFileURL(resolve(root,'src/core/validate.mjs')).href);const {registry}=await import(pathToFileURL(resolve(root,'src/archetypes/index.mjs')).href);const validator:SourceValidator=spec=>validateSpec(spec,registry);
 const seenContent=new Set<string>();const seenIds=new Set<string>();const entries:{request:any;bindings:Record<string,never>}[]=[];let expectedRequired=0;const perGenre=new Map<string,number>();
 for(let n=0;n<50;n++){
  const archetype=ARCHETYPES[n%ARCHETYPES.length];const source=variant(archetype,Math.floor(n/ARCHETYPES.length));const before=canonical(source);
  // Hash ONLY actual gameplay extension content: IDs, metadata, timestamps and titles cannot inflate uniqueness.
  const digest=createHash('sha256').update(canonical(source.content.extensions)).digest('hex');assert.ok(!seenContent.has(digest));seenContent.add(digest);assert.ok(!seenIds.has(source.metadata.id));seenIds.add(source.metadata.id);
  const actual=validator(structuredClone(source));assert.equal(actual.status,'PASS',`${archetype}: ${JSON.stringify(actual)}`);assert.equal(actual.issues?.length??0,0);
  const mapped=mapGameSpec(source,validator);assert.equal(mapped.status,'PASS',JSON.stringify(mapped.diagnostics));assert.equal(canonical(source),before,'Bridge does not mutate gameplay');assert.equal(validateContract('game-asset-request',mapped.request).status,'PASS');
  const request=mapped.request!;for(const slot of Object.values(request.slots)){assert.equal(slot.required,true);assert.equal(slot.fallbackPolicy,'none');assert.deepEqual(slot.requiredStates,['idle']);expectedRequired++;}
  if(archetype==='arcade_shooter')assert.equal(Object.hasOwn(request.slots,'bullet.enemy'),source.content.extensions.arcade_shooter.enemyFireIntervalTicks>0);
  const unresolved=resolveAssets({request,visual:json('examples/visual-spec.json'),profile:json('examples/build-profile.json'),registry:[],processorCapabilities:[{kind:'sprite2d',formats:['png']}]});assert.equal(unresolved.status,'FAIL','Synthetic demand is not available approved artwork');assert.equal(unresolved.missingRequired.length,Object.keys(request.slots).length);assert.equal(Object.keys(unresolved.bindings).length,0);
  entries.push({request,bindings:{}});perGenre.set(archetype,(perGenre.get(archetype)??0)+1);
 }
 assert.equal(seenContent.size,50);assert.equal(seenIds.size,50);assert.equal(perGenre.size,6);for(const count of perGenre.values())assert.ok(count>=8);
 const coverage=summarizeCoverage(entries);assert.equal(coverage.status,'BLOCKED');assert.equal(coverage.totalSlots,expectedRequired);assert.equal(coverage.missingRequired,expectedRequired);assert.equal(coverage.boundSlots,0);assert.equal(coverage.missingRate,1);assert.equal(coverage.reuseRate,0);assert.equal(coverage.genresPresent.length,6);
 // Actual upstream negative control per archetype, not a constant PASS seam.
 for(const archetype of ARCHETYPES){const broken=variant(archetype,0);broken.action_space={type:'invalid'};assert.equal(validator(broken).status,'FAIL');assert.equal(mapGameSpec(broken,validator).status,'FAIL');}
});
