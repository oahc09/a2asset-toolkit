/** Objective evidence evaluation, NOT image generation or an approval authority. */
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {validateContract,diagnostic,type Report,type Diagnostic} from '../contracts/validate.js';
export const benchmarks=['BG-01','BG-02','BG-03','BG-04'] as const;
export const genres=['sokoban','match3','merge2048','block_puzzle','falling_blocks','arcade_shooter'] as const;
type Gate='G0'|'G1'|'G2'|'G3';
type Json=Record<string,any>;
export interface ImageEvidence {path:string;sha256:string;bytes:Uint8Array;origin:'runtime'|'approved-reference';}
export interface VisualReview {gameId:string;themeId:string;buildSha256:string;referenceSha256:string;currentSha256:string;reviewer:string;reviewedAt:string;decision:'approve'|'reject';differenceExplanation:string;tolerance:string;}
export interface ThemeEvidence {theme:Json;rightsReviewId:string;visualReviewId:string;}
export interface RuntimeEvidence {
 benchmark:typeof benchmarks[number];gameId:string;themeId:string;buildSha256:string;logicSha256:string;deviceId:string;engineSha:string;
 g0:Report;g1:Report;reference:ImageEvidence;current:ImageEvidence;review?:VisualReview;
 visualChecks:Record<string,boolean>;checks:Record<string,boolean>;metrics:{loadMs:number;textureBytes:number;fps:number;errors:number};
 logSha256:string;logBytes:Uint8Array;
}
export interface FrozenBaseline {deviceId:string;sha256:string;maxLoadMs:number;maxTextureBytes:number;minFps:number;}
export interface QualityInput {themes:ThemeEvidence[];runs:RuntimeEvidence[];baselines:FrozenBaseline[];now:string;}
/** Caller must authenticate externally recorded reviews/runs/baselines. Never use an always-true verifier in production. */
export interface EvidenceTrust {verifyTheme:(theme:ThemeEvidence)=>boolean;verifyReview:(review:VisualReview)=>boolean;verifyRun:(run:RuntimeEvidence)=>boolean;verifyBaseline:(baseline:FrozenBaseline)=>boolean;}
export interface QualityReport extends Report {gates:Record<Gate,Report>;productionAuthorized:false;}
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const hash=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const nonempty=(s:unknown):s is string=>typeof s==='string'&&s.trim().length>0;
const timestamp=(s:unknown):s is string=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s)||!Number.isFinite(Date.parse(s)))return false;const [y,m,d]=s.slice(0,10).split('-').map(Number);return m>=1&&m<=12&&d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate();};
const safePath=(s:unknown)=>typeof s==='string'&&/^[a-zA-Z0-9_.@/+\-]+$/.test(s)&&!s.startsWith('/')&&!s.split('/').some(p=>p==='..'||p===''||p==='.');
const checks:Record<typeof benchmarks[number],string[]>={
 'BG-01':['display','animation','collisionFeedback','audioTrigger','release','ui','scale'],
 'BG-02':['display','animation','collisionFeedback','audioTrigger','release','swap','eliminate','nineSlice'],
 'BG-03':['display','animation','collisionFeedback','audioTrigger','release','enemy','bullet','explosion','sceneSwitch'],
 'BG-04':['display','animation','collisionFeedback','audioTrigger','release','tilemap','camera','bounds','pivot'],
};
function empty():Report{return {schemaVersion:'1.0.0',status:'PASS',diagnostics:[],artifactPaths:[]};}
export function evaluateQuality(input:QualityInput,trust?:EvidenceTrust):QualityReport{
 const gates:Record<Gate,Report>={G0:empty(),G1:empty(),G2:empty(),G3:empty()};
 const add=(gate:Gate,blocked:boolean,path:string,message:string)=>{const g=gates[gate];g.diagnostics.push(diagnostic(blocked?'E_QUALITY_EVIDENCE_MISSING':'E_QUALITY_INVALID',path,message));if(!blocked)g.status='FAIL';else if(g.status==='PASS')g.status='BLOCKED';};
 const authenticated=(gate:Gate,path:string,fn:(()=>boolean)|undefined)=>{if(!fn){add(gate,true,path,'Trusted evidence verification unavailable; structure is not approval.');return;}try{if(fn()!==true)add(gate,false,path,'Evidence authenticity verification failed.');}catch{add(gate,true,path,'Evidence verification unavailable.');}};
 const image=(value:ImageEvidence|undefined,origin:ImageEvidence['origin'],path:string)=>{
  if(!value){add('G2',true,path,'Required actual image missing.');return;}
  if(!safePath(value.path)||!value.path.endsWith('.png')||value.origin!==origin||!(value.bytes instanceof Uint8Array)||!hash(value.sha256)||sha(value.bytes)!==value.sha256){add('G2',false,path,'Image path, origin, bytes or digest invalid.');return;}
  try{const bytes=Buffer.from(value.bytes);if(bytes.length<24||bytes.length>16*1024*1024||bytes.readUInt32BE(16)*bytes.readUInt32BE(20)>2048*2048)throw Error();const png=PNG.sync.read(bytes,{checkCRC:true});if(!png.width||!png.height)throw Error();}catch{add('G2',false,path,'Image must be a decodable bounded PNG, not a fabricated path or corrupt header.');}
 };
 try{
  if(!input||!Array.isArray(input.themes)||!Array.isArray(input.runs)||!Array.isArray(input.baselines)||!timestamp(input.now))throw Error('Invalid quality input envelope.');
  if(!input.runs.length){add('G0',true,'/runs','No structural gate evidence.');add('G1',true,'/runs','No asset gate evidence.');}
  const themes=new Map<string,ThemeEvidence>();
  for(const [n,t] of input.themes.entries()){
   if(!t||validateContract('theme-pack',t.theme).status!=='PASS'){add('G2',false,`/themes/${n}`,'Theme schema invalid.');continue;}
   if(themes.has(t.theme.themeId)){add('G2',false,`/themes/${n}`,'Duplicate theme identity.');continue;}themes.set(t.theme.themeId,t);
   if(!['approved','published'].includes(t.theme.approvalStatus))add('G2',true,`/themes/${n}`,'Theme is not currently approved or published.');
   if(!nonempty(t.rightsReviewId)||!nonempty(t.visualReviewId))add('G2',true,`/themes/${n}`,'Both rights and visual approval records are required.');
   authenticated('G2',`/themes/${n}`,trust&&(()=>trust.verifyTheme(t)));
  }
  if(themes.size<2)add('G2',true,'/themes','At least two independently approved themes required.');
  const baseline=new Map<string,FrozenBaseline>();
  for(const b of input.baselines){if(!b||!nonempty(b.deviceId)||!hash(b.sha256)||![b.maxLoadMs,b.maxTextureBytes,b.minFps].every(v=>Number.isFinite(v)&&v>0)||baseline.has(b.deviceId)){add('G3',false,'/baselines','Invalid or duplicate frozen device thresholds.');continue;}baseline.set(b.deviceId,b);authenticated('G3','/baselines',trust&&(()=>trust.verifyBaseline(b)));}
  const seen=new Set<string>();const match3:RuntimeEvidence[]=[];
  for(const [n,r] of input.runs.entries()){
   const p=`/runs/${n}`;
   if(!r||!benchmarks.includes(r.benchmark)||!nonempty(r.gameId)||!hash(r.buildSha256)||!hash(r.logicSha256)||!nonempty(r.engineSha)||!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(r.engineSha)){add('G3',false,p,'Runtime identity or immutable engine/build/logic hashes invalid.');continue;}
   const key=[r.benchmark,r.themeId,r.deviceId].join('/');if(seen.has(key))add('G3',false,p,'Duplicate runtime evidence.');seen.add(key);
   if(!themes.has(r.themeId))add('G2',false,p,'Runtime references absent theme.');
   for(const [name,rep] of [['G0',r.g0],['G1',r.g1]] as const){if(!rep||rep.status==='BLOCKED')add(name,true,p,'Objective gate evidence unavailable.');else if(rep.schemaVersion!=='1.0.0'||rep.status!=='PASS'||!Array.isArray(rep.diagnostics)||rep.diagnostics.some(d=>d.severity==='error'))add(name,false,p,'Objective gate failed or malformed.');}
   image(r.reference,'approved-reference',p+'/reference');image(r.current,'runtime',p+'/current');
   for(const name of ['palette','viewAngle','outline','pixelDensity','safeArea'])if(!r.visualChecks||!Object.hasOwn(r.visualChecks,name)||r.visualChecks[name]!==true)add('G2',!r.visualChecks||!Object.hasOwn(r.visualChecks,name),p+'/visualChecks/'+name,'Frozen visual rule not demonstrated.');
   const v=r.review;
   if(!v)add('G2',true,p+'/review','Human signed visual review missing.');
   else {if(v.decision!=='approve'||v.gameId!==r.gameId||v.themeId!==r.themeId||v.buildSha256!==r.buildSha256||(r.current&&v.currentSha256!==r.current.sha256)||(r.reference&&v.referenceSha256!==r.reference.sha256)||![v.reviewer,v.differenceExplanation,v.tolerance].every(nonempty)||!timestamp(v.reviewedAt)||Date.parse(v.reviewedAt)>Date.parse(input.now))add('G2',false,p+'/review','Review rejected, incomplete, stale-bound or future-dated.');authenticated('G2',p+'/review',trust&&(()=>trust.verifyReview(v)));}
   if(!(r.logBytes instanceof Uint8Array)||!r.logBytes.length||!hash(r.logSha256)||sha(r.logBytes)!==r.logSha256)add('G3',false,p+'/log','Actual nonempty runtime log bytes and matching SHA required.');
   for(const name of checks[r.benchmark])if(!r.checks||!Object.hasOwn(r.checks,name)||r.checks[name]!==true)add('G3',!r.checks||!Object.hasOwn(r.checks,name),p+'/checks/'+name,'Required runtime scenario not demonstrated.');
   const b=baseline.get(r.deviceId);if(!b)add('G3',true,p+'/deviceId','No frozen measured device baseline; no invented default FPS.');
   const m=r.metrics;
   if(!m||![m.loadMs,m.textureBytes,m.fps,m.errors].every(v=>Number.isFinite(v)&&v>=0))add('G3',false,p+'/metrics','Missing or invalid measured runtime metrics.');
   else if(m.errors!==0||(b&&(m.loadMs>b.maxLoadMs||m.textureBytes>b.maxTextureBytes||m.fps<b.minFps)))add('G3',false,p+'/metrics','Actual metrics exceed frozen budget or contain errors.');
   authenticated('G3',p,trust&&(()=>trust.verifyRun(r)));
   if(r.benchmark==='BG-02')match3.push(r);
  }
  for(const id of benchmarks)if(!input.runs.some(r=>r?.benchmark===id))add('G3',true,'/runs/'+id,'Required benchmark not actually evidenced.');
  if(!match3.some(a=>match3.some(b=>a.themeId!==b.themeId&&a.gameId===b.gameId&&a.logicSha256===b.logicSha256)))add('G2',true,'/runs/BG-02','Two-theme Match3 screenshots with unchanged gameplay hash required.');
 }catch(e){add('G0',false,'',e instanceof Error?e.message:'Malformed quality input.');}
 const all=Object.values(gates);return {schemaVersion:'1.0.0',status:all.some(g=>g.status==='FAIL')?'FAIL':all.some(g=>g.status==='BLOCKED')?'BLOCKED':'PASS',diagnostics:all.flatMap(g=>g.diagnostics),artifactPaths:[],gates,productionAuthorized:false};
}
/** Slot coverage only. A binding count is not a rights/visual/production certification. */
export function summarizeCoverage(entries:readonly {request:Json;bindings:Json}[]):Report&{totalSlots:number;boundSlots:number;missingRequired:number;missingRate:number;reuseRate:number;genresPresent:string[]}{
 const diagnostics:Diagnostic[]=[];let totalSlots=0,boundSlots=0,missingRequired=0;const assetUses=new Map<string,number>(),present=new Set<string>(),games=new Set<string>();
 for(const entry of entries){const v=validateContract('game-asset-request',entry.request);diagnostics.push(...v.diagnostics);if(v.status!=='PASS')continue;const r=entry.request;if(games.has(r.gameId)){diagnostics.push(diagnostic('E_QUALITY_INVALID','/gameId','Duplicate game request.'));continue;}games.add(r.gameId);present.add(r.genre);
  const bindings=entry.bindings;
  const valid=new Set<string>();
  if(!bindings||typeof bindings!=='object'||Array.isArray(bindings))diagnostics.push(diagnostic('E_QUALITY_INVALID','/bindings','Expected Resolver binding map.'));
  else for(const [slot,b] of Object.entries(bindings)){
   if(!Object.hasOwn(r.slots,slot)){diagnostics.push(diagnostic('E_QUALITY_INVALID','/bindings/'+slot,'Unknown bound slot.'));continue;}
   if(!b||typeof b!=='object'||Array.isArray(b)){diagnostics.push(diagnostic('E_QUALITY_INVALID','/bindings/'+slot,'Invalid resolved binding.'));continue;}
   if(b.placeholder===true)continue;
   const allowed=['assetId','version','variantId','assetSha256','bindingSource','kind','placeholder','files','sourceHashes'];
   const pin=Object.fromEntries(['assetId','version','variantId','assetSha256','bindingSource'].filter(k=>Object.hasOwn(b,k)).map(k=>[k,(b as Json)[k]]));
   const schema=validateContract('asset-binding',{schemaVersion:'1.0.0',gameId:r.gameId,bindings:{[slot]:pin}});
   if(schema.status!=='PASS'||Object.keys(b).some(k=>!allowed.includes(k))||(b.placeholder!==undefined&&b.placeholder!==false)||b.bindingSource==='preview-placeholder'){diagnostics.push(diagnostic('E_QUALITY_INVALID','/bindings/'+slot,'Malformed asset binding identity or unexpected fields.'));continue;}
   if(!Object.hasOwn(b,'kind')){diagnostics.push(diagnostic('E_QUALITY_EVIDENCE_MISSING','/bindings/'+slot,'Resolved asset kind required to establish compatibility.'));continue;}
   if(b.kind!==r.slots[slot].kind){diagnostics.push(diagnostic('E_QUALITY_INVALID','/bindings/'+slot,'Resolved asset kind does not match required slot.'));continue;}
   valid.add(slot);
  }
  for(const [slot,value] of Object.entries(r.slots) as [string,Json][]){totalSlots++;if(valid.has(slot)){const binding=(bindings as Json)[slot];boundSlots++;const key=binding.assetId+'@'+binding.version;assetUses.set(key,(assetUses.get(key)??0)+1);}else if(value.required)missingRequired++;}
 }
 if(missingRequired)diagnostics.push(diagnostic('E_QUALITY_EVIDENCE_MISSING','/slots',`${missingRequired} required slots unresolved; counts are not build certification.`));
 const missing=genres.filter(g=>!present.has(g));if(missing.length)diagnostics.push(diagnostic('E_QUALITY_EVIDENCE_MISSING','/genres',`Missing actual requests for ${missing.join(', ')}`));
 return {schemaVersion:'1.0.0',status:diagnostics.some(d=>d.code!=='E_QUALITY_EVIDENCE_MISSING')?'FAIL':diagnostics.length?'BLOCKED':'PASS',diagnostics,artifactPaths:[],totalSlots,boundSlots,missingRequired,missingRate:totalSlots?(totalSlots-boundSlots)/totalSlots:0,reuseRate:boundSlots?(boundSlots-assetUses.size)/boundSlots:0,genresPresent:[...present].sort()};
}
