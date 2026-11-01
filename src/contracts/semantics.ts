import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { diagnostic, report, validateContract, type ContractName, type Diagnostic } from './validate.js';
// JSON is schema-checked before semantic traversal. No converters or registry writes here.
type Json = Record<string, any>;
export interface Context { root?: string; mode?: 'Preview'|'Production'; approvedEffects?: readonly string[]; }
export function validateSemantics(name: ContractName, input: unknown, context: Context = {}) {
 const structural=validateContract(name,input);
 if(structural.status!=='PASS') return structural;
 const x=input as Json, d:Diagnostic[]=[];
 const fail=(code:string,path:string,message:string)=>d.push(diagnostic(code,path,message));
 const checkedPaths=new Map<string,string>();
 function file(path:string,pointer:string,hash?:string,bytes?:number) {
  if(!/^[a-zA-Z0-9_.@/+\-]+$/.test(path)||path.startsWith('/')||path.split('/').some(p=>p==='.'||p==='..'||p==='')) {fail('E_SECURITY_PATH_ESCAPE',pointer,'Path must be a normalized relative POSIX path');return;}
  const prior=checkedPaths.get(path.toLowerCase());
  if(prior && prior!==path) fail('E_SECURITY_PATH_ESCAPE',pointer,'Case-colliding file paths');
  checkedPaths.set(path.toLowerCase(),path);
  if(!context.root) {fail('E_REFERENCE_MISSING',pointer,'Filesystem root required to verify actual evidence/bytes');return;}
  try {
   const root=realpathSync(context.root), full=resolve(root,path), rel=relative(root,realpathSync(full));
   if(rel.startsWith('..'+sep)||rel==='..'||rel.startsWith(sep)) throw Error('outside root');
   let at=root;for(const part of path.split('/')) {at=resolve(at,part);if(lstatSync(at).isSymbolicLink()) throw Error('symlink');}
   const stat=lstatSync(full);if(!stat.isFile()||stat.size>64*1024*1024) throw Error('not a bounded regular file');
   const raw=readFileSync(full);
   if(hash && createHash('sha256').update(raw).digest('hex')!==hash) fail('E_LOCK_DRIFT',pointer,'Actual file SHA256 differs');
   if(bytes!==undefined&&raw.length!==bytes) fail('E_LOCK_DRIFT',pointer,'Actual byte count differs');
  } catch {fail('E_SECURITY_UNSAFE_CONTENT',pointer,'File missing, escaped, symlinked or exceeds 64 MiB audit limit');}
 }
 if(name==='asset-definition') {
  x.sources.forEach((s:Json,i:number)=>file(s.path,`/sources/${i}/path`,s.sha256));
  (x.variants??[]).forEach((s:Json,i:number)=>file(s.path,`/variants/${i}/path`,s.sha256));
  file(x.provenance.licenseEvidencePath,'/provenance/licenseEvidencePath');
  const p=x.provenance;
  if(x.approvalStatus==='published'||context.mode==='Production') {
   if(x.approvalStatus!=='published'||p.redistributionApproved!==true||!p.reviewedAt||!p.sourceUrl||!p.author?.trim()||!p.reviewer?.trim()) fail('E_RIGHTS_DENIED','/provenance','Production requires published status and complete human rights review');
   if(/LicenseRef-|NOASSERTION/.test(p.licenseExpression)) fail('E_LICENSE_UNKNOWN','/provenance/licenseExpression','Custom or unknown licenses require an external human rights conclusion; unsupported in M0');
  }
  const states=x.capabilities.states??[], actual=Object.keys(x.stateFrames??{});
  if(states.length && (states.some((s:string)=>!actual.includes(s))||actual.some(s=>!states.includes(s)))) fail('E_REFERENCE_MISSING','/stateFrames','State capability names must match real frame mappings');
  for(const [state,clip] of Object.entries(x.stateFrames??{}) as [string,Json][]) clip.frames.forEach((f:Json,i:number)=>{if(f.sourceIndex>=x.sources.length) fail('E_REFERENCE_MISSING',`/stateFrames/${state}/frames/${i}/sourceIndex`,'Source index outside sources');});
  if(x.kind==='ui9slice') {const size=x.geometry?.pixelSize,n=x.nineSlice;if(!size||n.left+n.right>size[0]||n.top+n.bottom>size[1])fail('E_SCHEMA_INVALID','/nineSlice','Insets require compatible pixel dimensions');}
  if(x.kind==='vfx2d'&&x.vfx.effectKind==='procedural-approved'&&!context.approvedEffects?.includes(x.vfx.approvedEffectId))fail('E_PROCESSOR_UNSUPPORTED','/vfx','Effect ID not in frozen whitelist');
  if(x.kind==='vfx2d'&&x.vfx.effectKind==='frames'&&!x.stateFrames)fail('E_REFERENCE_MISSING','/stateFrames','Frame VFX requires real frames');
 }
 if(name==='bundle-manifest') {
  const files=new Set<string>();
  x.files.forEach((f:Json,i:number)=>{if(files.has(f.path))fail('E_SCHEMA_INVALID',`/files/${i}`,'Duplicate file path');files.add(f.path);file(f.path,`/files/${i}/path`,f.sha256,f.bytes);});
  if(x.licenseNoticePath&&!files.has(x.licenseNoticePath)) fail('E_REFERENCE_MISSING','/licenseNoticePath','Notice must be in manifest files');
  for(const [slot,b] of Object.entries(x.bindings) as [string,Json][]) {
   const p=`/bindings/${slot}`;
   if(context.mode==='Production'&&b.placeholder) fail('E_RIGHTS_DENIED',p+'/placeholder','Production cannot use placeholders');
   const refs:string[]=[...b.files];if(b.atlasRegion)refs.push(b.atlasRegion.file);
   for(const clip of Object.values(b.stateClips??{}) as Json[])for(const f of clip.frames){refs.push(f.file);if(f.rect&&(f.rect[2]<=0||f.rect[3]<=0))fail('E_SCHEMA_INVALID',p+'/stateClips','Frame rectangle must have positive dimensions');if(f.trimOffset&&f.sourceSize&&f.rect&&(f.trimOffset[0]<0||f.trimOffset[1]<0||f.trimOffset[0]+f.rect[2]>f.sourceSize[0]||f.trimOffset[1]+f.rect[3]>f.sourceSize[1]))fail('E_SCHEMA_INVALID',p+'/stateClips','Trim rectangle exceeds source size');}
   for(const ref of refs)if(!files.has(ref))fail('E_REFERENCE_MISSING',p,`Missing manifest file ${ref}`);
   if(b.atlasRegion&&(b.atlasRegion.rect[2]<=0||b.atlasRegion.rect[3]<=0))fail('E_SCHEMA_INVALID',p+'/atlasRegion','Atlas rectangle must have positive dimensions');
  }
 }
 return report(d);
}
