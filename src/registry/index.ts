import {mkdirSync,lstatSync,readFileSync,readSync,writeFileSync,renameSync,unlinkSync,openSync,closeSync,fstatSync,fsyncSync,readdirSync,constants} from 'node:fs';
import {resolve,join,dirname,parse} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {validateContract,diagnostic,type Report} from '../contracts/validate.js';
export type AssetState='imported'|'inspected'|'approved'|'published'|'deprecated'|'quarantined';
export interface ReviewRecord {assetKey:string;definitionDigest:string;evidenceSha256:string;reviewer:string;reviewedAt:string;sourceUrl:string;author:string;licenseExpression:string;redistributionApproved:boolean;decision:'approve'|'reject';rightsConclusion?:string;notes?:string}
export interface RegistryEntry {definition:Record<string,any>;definitionDigest:string;files:Record<string,string>;state:AssetState;history:StateEvent[];currentReview?:ReviewRecord;effectiveDefinition:Record<string,any>}
interface StateEvent {sequence:number;from:AssetState;to:AssetState;previousDigest:string;review?:ReviewRecord;digest:string}
interface Stored {definition:Record<string,any>;definitionDigest:string;files:Record<string,string>;recordDigest:string}
export interface RegistryResult extends Report {assetKey?:string;record?:RegistryEntry;records?:RegistryEntry[];notices?:string}
const sha=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
export function canonical(value:any):string {if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
const keyPattern=/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*@\d+\.\d+\.\d+$/;
const allowed:Record<AssetState,AssetState[]>={imported:['inspected','quarantined'],inspected:['approved','quarantined'],approved:['published','quarantined'],published:['deprecated','quarantined'],deprecated:['inspected'],quarantined:['inspected']};
class Refusal extends Error {constructor(public code:string,message:string){super(message)}}
function reject(code:string,message:string):never{throw new Refusal(code,message);}
function pathOK(p:string){if(!/^[A-Za-z0-9_.@/+\-]+$/.test(p)||p.startsWith('/')||p.split('/').some(x=>!x||x==='.'||x==='..'))reject('E_SECURITY_PATH_ESCAPE','Not a normalized relative POSIX path');}
function safeDirectory(path:string){const abs=resolve(path);let current=parse(abs).root;for(const part of abs.slice(current.length).split('/').filter(Boolean)){current=join(current,part);try{const s=lstatSync(current);if(s.isSymbolicLink()||!s.isDirectory())reject('E_SECURITY_PATH_ESCAPE','Registry directory must not contain symlinks or non-directories');}catch(e:any){if(e.code==='ENOENT')mkdirSync(current,{mode:0o700});else throw e;}}}
function readRegular(path:string):Buffer {
 const before=lstatSync(path);if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>64*1024*1024)reject('E_SECURITY_UNSAFE_CONTENT','Not a bounded private regular file');
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try {const s=fstatSync(fd);if(!s.isFile()||s.nlink!==1||s.size!==before.size||s.dev!==before.dev||s.ino!==before.ino||s.mode!==before.mode)reject('E_SECURITY_UNSAFE_CONTENT','Registry file changed before read');
 const data=Buffer.alloc(s.size);let offset=0;while(offset<data.length){const n=readSync(fd,data,offset,data.length-offset,offset);if(!n)reject('E_SECURITY_UNSAFE_CONTENT','Registry file truncated');offset+=n;}
 const after=fstatSync(fd);if(after.size!==s.size||after.mtimeMs!==s.mtimeMs||after.ctimeMs!==s.ctimeMs||after.nlink!==1)reject('E_SECURITY_UNSAFE_CONTENT','Registry file changed during read');return data;
 }finally{closeSync(fd)}
}
function atomic(path:string,data:string|Uint8Array){safeDirectory(dirname(path));const temp=join(dirname(path),'.tmp-'+randomUUID());let fd:number|undefined;try{fd=openSync(temp,'wx',0o600);writeFileSync(fd,data);fsyncSync(fd);closeSync(fd);fd=undefined;renameSync(temp,path);}finally{if(fd!==undefined)closeSync(fd);try{unlinkSync(temp)}catch{}}}
function localInspection(d:Record<string,any>){const states=d.capabilities.states??[], mapped=Object.keys(d.stateFrames??{});if(states.length!==mapped.length||states.some((state:string)=>!mapped.includes(state)))reject('E_REFERENCE_MISSING','Declared states must exactly match frame clips');for(const clip of Object.values(d.stateFrames??{}) as any[])for(const frame of clip.frames)if(frame.sourceIndex>=d.sources.length)reject('E_REFERENCE_MISSING','Frame source index exceeds available sources');if(d.kind==='ui9slice'){const n=d.nineSlice,size=d.geometry?.pixelSize;if(!size||n.left+n.right>size[0]||n.top+n.bottom>size[1])reject('E_SCHEMA_INVALID','Nine-slice exceeds declared source dimensions');}}
function errorReport(e:unknown):RegistryResult {const r=e instanceof Refusal?e:new Refusal('E_REGISTRY_IO',e instanceof Error?e.message:'Registry I/O failure');return {schemaVersion:'1.0.0',status:'FAIL',diagnostics:[diagnostic(r.code,'',r.message,'Inspect the input and registry integrity; never bypass rights or overwrite immutable versions.')],artifactPaths:[]};}
const pass=():RegistryResult=>({schemaVersion:'1.0.0',status:'PASS',diagnostics:[],artifactPaths:[]});
/** Private local registry. No network, image generation, decoding or automatic approval. */
export class AssetRegistry {
 readonly root:string;
 constructor(root:string){this.root=resolve(root);}
 private setup(){safeDirectory(this.root);for(const p of ['store/sha256','registry/definitions','registry/history'])safeDirectory(join(this.root,p));}
 private locked<T>(fn:()=>T):T {this.setup();const lock=join(this.root,'.writer-lock');try{mkdirSync(lock,{mode:0o700});}catch{reject('E_REGISTRY_BUSY','Another writer or stale lock exists; inspect before recovery');}try{return fn();}finally{try{const {rmdirSync}=requireFs; rmdirSync(lock);}catch{}}}
 private key(key:string){if(!keyPattern.test(key)||key.length>180)reject('E_SCHEMA_INVALID','Invalid assetId@version');return key;}
 private recordPath(key:string){return join(this.root,'registry/definitions',this.key(key)+'.json');}
 private blobPath(digest:string){if(!/^[a-f0-9]{64}$/.test(digest))reject('E_LOCK_DRIFT','Invalid digest');return join(this.root,'store/sha256',digest.slice(0,2),digest);}
 private blob(digest:string){const path=this.blobPath(digest);safeDirectory(dirname(path));const data=readRegular(path);if(sha(data)!==digest)reject('E_LOCK_DRIFT','Blob hash differs from registry digest');return data;}
 importDefinition(definition:unknown,files:Map<string,Uint8Array>):RegistryResult {try{return this.locked(()=>{
  const schema=validateContract('asset-definition',definition);if(schema.status!=='PASS')return schema;
  const d=structuredClone(definition) as Record<string,any>;if(!['imported','quarantined'].includes(d.approvalStatus))reject('E_RIGHTS_DENIED','Import cannot invent inspection or human approval');
  const key=this.key(d.assetId+'@'+d.version), paths=new Map<string,string>(), mapped:Record<string,string>=Object.create(null);
  const required=[...d.sources,...(d.variants??[]),{path:d.provenance.licenseEvidencePath}];
  for(const f of required){pathOK(f.path);const lower=f.path.toLowerCase();if(paths.has(lower)&&paths.get(lower)!==f.path)reject('E_SECURITY_PATH_ESCAPE','Case-colliding source paths');paths.set(lower,f.path);const bytes=files.get(f.path);if(!(bytes instanceof Uint8Array)||bytes.length===0||bytes.length>64*1024*1024)reject('E_REFERENCE_MISSING','Missing, empty or oversized source/evidence');const hash=sha(bytes);if(f.sha256&&f.sha256!==hash)reject('E_LOCK_DRIFT','Input bytes differ from declared SHA256');if(mapped[f.path]&&mapped[f.path]!==hash)reject('E_LOCK_DRIFT','Conflicting path content');mapped[f.path]=hash;}
  for(const path of files.keys()){pathOK(path);if(!Object.hasOwn(mapped,path))reject('E_SECURITY_UNSAFE_CONTENT','Unreferenced import input refused');}
  const body={definition:d,definitionDigest:sha(canonical(d)),files:mapped};const record:Stored={...body,recordDigest:sha(canonical(body))};const out=this.recordPath(key);
  try{const existing=JSON.parse(readRegular(out).toString());if(canonical(existing)!==canonical(record))reject('E_VERSION_CONFLICT','assetId@version metadata/content is immutable');return this.get(key);}catch(e:any){if(e.code!=='ENOENT')throw e;}
  for(const [path,hash]of Object.entries(mapped)){const dest=this.blobPath(hash);safeDirectory(dirname(dest));try{if(sha(readRegular(dest))!==hash)reject('E_LOCK_DRIFT','Existing blob is corrupt');}catch(e:any){if(e.code!=='ENOENT')throw e;atomic(dest,files.get(path)!);}}
  atomic(out,canonical(record)+'\n');return this.get(key);
 });}catch(e){return errorReport(e)}}
 get(key:string):RegistryResult {try{
  this.setup();const stored=JSON.parse(readRegular(this.recordPath(key)).toString()) as Stored;
  const {recordDigest,...storedBody}=stored;if(sha(canonical(storedBody))!==recordDigest)reject('E_LOCK_DRIFT','Record content/evidence map integrity mismatch');
  if(validateContract('asset-definition',stored.definition).status!=='PASS'||sha(canonical(stored.definition))!==stored.definitionDigest||stored.definition.assetId+'@'+stored.definition.version!==key)reject('E_LOCK_DRIFT','Definition integrity mismatch');
  for(const [path,digest] of Object.entries(stored.files)){pathOK(path);this.blob(digest);}
  for(const f of [...stored.definition.sources,...(stored.definition.variants??[])])if(stored.files[f.path]!==f.sha256)reject('E_LOCK_DRIFT','Source mapping mismatch');
  if(!stored.files[stored.definition.provenance.licenseEvidencePath])reject('E_REFERENCE_MISSING','Missing license evidence mapping');
  if(!['imported','quarantined'].includes(stored.definition.approvalStatus))reject('E_RIGHTS_DENIED','Registry genesis must not manufacture inspection or approval');
  let state=stored.definition.approvalStatus as AssetState,previousDigest=stored.definitionDigest;const history:StateEvent[]=[];let currentReview:ReviewRecord|undefined;
  const directory=join(this.root,'registry/history',key);safeDirectory(directory);
  const names=readdirSync(directory).filter(n=>!n.startsWith('.tmp-')).sort();
  for(const [i,name]of names.entries()){if(name!==String(i+1).padStart(8,'0')+'.json')reject('E_LOCK_DRIFT','Invalid or missing review sequence');const event=JSON.parse(readRegular(join(directory,name)).toString()) as StateEvent;const {digest,...body}=event;if(event.sequence!==i+1||event.from!==state||event.previousDigest!==previousDigest||sha(canonical(body))!==digest||!allowed[state].includes(event.to))reject('E_LOCK_DRIFT','Approval history integrity mismatch');if(['inspected','approved','published'].includes(event.to))localInspection(stored.definition);if(event.to==='approved'||event.to==='published')this.validateReview(key,stored,event.review);if(event.to==='approved'&&history.some(e=>e.to==='approved'&&e.review&&Date.parse(e.review.reviewedAt)>=Date.parse(event.review!.reviewedAt)))reject('E_RIGHTS_DENIED','Replayed stale approval in history');if(event.to==='published'&&canonical(event.review)!==canonical(currentReview))reject('E_RIGHTS_DENIED','Publication review differs from approval');state=event.to;previousDigest=digest;history.push(event);if(['deprecated','quarantined','inspected'].includes(event.to))currentReview=undefined;if(event.review)currentReview=event.review;}
  const effectiveDefinition=structuredClone(stored.definition);effectiveDefinition.approvalStatus=state;if(currentReview)for(const field of ['reviewer','reviewedAt','sourceUrl','author','licenseExpression','redistributionApproved'] as const)effectiveDefinition.provenance[field]=currentReview[field];
  return {...pass(),assetKey:key,record:{...stored,state,history,currentReview,effectiveDefinition}};
 }catch(e){return errorReport(e)}}
 list(filters:{kind?:string;role?:string;status?:AssetState}={}):RegistryResult {try{this.setup();const records:RegistryEntry[]=[];for(const name of readdirSync(join(this.root,'registry/definitions')).sort()){if(name.startsWith('.tmp-'))continue;if(!name.endsWith('.json'))reject('E_LOCK_DRIFT','Unexpected registry entry');const r=this.get(name.slice(0,-5));if(r.status!=='PASS')return r;const a=r.record!;if((!filters.kind||a.definition.kind===filters.kind)&&(!filters.role||a.definition.roles.includes(filters.role))&&(!filters.status||a.state===filters.status))records.push(a);}return {...pass(),records};}catch(e){return errorReport(e)}}
 transition(key:string,to:AssetState,review?:ReviewRecord):RegistryResult {try{return this.locked(()=>{
  const result=this.get(key);if(result.status!=='PASS')return result;const entry=result.record!;
  if(!allowed[entry.state].includes(to))reject('E_STATE_TRANSITION','Illegal approval state transition');
  if(['inspected','approved','published'].includes(to))localInspection(entry.definition);
  if(to==='approved'||to==='published')this.validateReview(key,entry,review);
  if(to==='approved'&&entry.history.some(e=>e.to==='approved'&&e.review&&Date.parse(e.review.reviewedAt)>=Date.parse(review!.reviewedAt)))reject('E_RIGHTS_DENIED','Restoration requires a new review newer than every prior approval');
  if(to==='published'&&canonical(review)!==canonical(entry.currentReview))reject('E_RIGHTS_DENIED','Publication must use the current approved review unchanged');
  if(review&&to!=='approved'&&to!=='published')reject('E_SCHEMA_INVALID','Review records are only accepted with approval/publication transitions');
  const body={sequence:entry.history.length+1,from:entry.state,to,previousDigest:entry.history.at(-1)?.digest??entry.definitionDigest,...(review?{review:structuredClone(review)}:{})};
  const event={...body,digest:sha(canonical(body))};atomic(join(this.root,'registry/history',key,String(body.sequence).padStart(8,'0')+'.json'),canonical(event)+'\n');return this.get(key);
 });}catch(e){return errorReport(e)}}
 private validateReview(key:string,entry:Pick<RegistryEntry,'definition'|'definitionDigest'|'files'>,review?:ReviewRecord){
  if(review&&Object.keys(review).some(k=>!['assetKey','definitionDigest','evidenceSha256','reviewer','reviewedAt','sourceUrl','author','licenseExpression','redistributionApproved','decision','rightsConclusion','notes'].includes(k)))reject('E_SCHEMA_INVALID','Unknown review field');
  if(!review||review.assetKey!==key||review.definitionDigest!==entry.definitionDigest||review.evidenceSha256!==entry.files[entry.definition.provenance.licenseEvidencePath])reject('E_RIGHTS_DENIED','Review must bind this exact definition and evidence');
  if(review.decision!=='approve'||review.redistributionApproved!==true||!review.reviewer?.trim()||!review.author?.trim()||!review.sourceUrl?.trim()||!review.licenseExpression?.trim())reject('E_RIGHTS_DENIED','Complete explicit human rights decision required');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(review.reviewedAt)||!Number.isFinite(Date.parse(review.reviewedAt))||Date.parse(review.reviewedAt)>Date.now())reject('E_RIGHTS_DENIED','Review time must be valid and not in the future');
  const candidate=structuredClone(entry.definition);Object.assign(candidate.provenance,{reviewedAt:review.reviewedAt,sourceUrl:review.sourceUrl});if(validateContract('asset-definition',candidate).status!=='PASS')reject('E_RIGHTS_DENIED','Review date or source URI is invalid');
  try{new URL(review.sourceUrl)}catch{reject('E_RIGHTS_DENIED','Source URL must be an absolute URI');}
  // Restricted supported SPDX subset; broader expressions require a future parser, never implicit acceptance.
  const simple=new Set(['MIT','Apache-2.0','BSD-2-Clause','BSD-3-Clause','CC0-1.0','CC-BY-4.0','OFL-1.1']);
  if(!simple.has(review.licenseExpression)&&!(/^(LicenseRef-[A-Za-z0-9.-]+|NOASSERTION)$/.test(review.licenseExpression)&&review.rightsConclusion?.trim()))reject('E_LICENSE_UNKNOWN','Unsupported license expression or missing explicit custom-license rights conclusion');
 }
 renderNotices(keys:readonly string[]):RegistryResult {try{const lines=['A2Asset third-party and owned asset notices',''];for(const key of [...new Set(keys)].sort()){const r=this.get(key);if(r.status!=='PASS')return r;const e=r.record!;if(e.state!=='published'||!e.currentReview)reject('E_RIGHTS_DENIED','Only explicitly published assets can contribute distribution notices');const p=e.currentReview;const clean=(text:string)=>text.replace(/[\r\n\t]/g,' ');lines.push(`Asset: ${key}`,`Author: ${clean(p.author)}`,`Source: ${clean(p.sourceUrl)}`,`License: ${clean(p.licenseExpression)}`,'');}return {...pass(),notices:lines.join('\n')};}catch(e){return errorReport(e)}}
 readBlob(digest:string):{report:RegistryResult;bytes?:Uint8Array}{try{this.setup();return {report:pass(),bytes:this.blob(digest)}}catch(e){return {report:errorReport(e)}}}
}
import * as requireFs from 'node:fs';
