import {hostname} from 'node:os';
import {readFileSync} from 'node:fs';
import {lstat,readdir,rename,rm,unlink,mkdir,rmdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {diagnostic,report,type Report} from '../contracts/validate.js';
import {canonical} from '../registry/index.js';
import {atomicFile,readSafe,requireDirectory,within,digest} from './io.js';
import {validatePackage} from './index.js';
export interface PublicationJournal {version:1;transactionId:string;owner:{pid:number;host:string;platform:string;bootId:string|null};workspace:string;out:string;registry:string;staging:string;backup:string;oldManifestSha256:string|null;newManifestSha256:string;phase:'prepared'|'old-moved'|'published';recoveryOutcome?:'RESTORED_OLD'|'KEPT_OLD'|'KEPT_NEW'|'ABORTED_INITIAL';}
const encoded=(v:unknown)=>Buffer.from(canonical(v)+'\n');
const journalFile=(out:string)=>join(out+'.writer-lock','transaction.json');
const markerFile=(registry:string)=>join(registry,'.writer-lock','publication.json');
const boot=()=>{try{return readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();}catch{return null;}};
const uuid=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s);
const hash=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
function refusal(message:string):never{throw Error('E_BUILD_RECOVERY_REQUIRED: '+message);}
export async function preparePublication(input:{workspace:string;out:string;registry:string;staging:string;backup:string;old:boolean}):Promise<PublicationJournal>{
 const j:PublicationJournal={version:1,transactionId:input.staging.slice((input.out+'.staging-').length),owner:{pid:process.pid,host:hostname(),platform:process.platform,bootId:boot()},workspace:resolve(input.workspace),out:input.out,registry:resolve(input.registry),staging:input.staging,backup:input.backup,oldManifestSha256:input.old?digest(await readSafe(join(input.out,'asset-manifest.json'))):null,newManifestSha256:digest(await readSafe(join(input.staging,'asset-manifest.json'))),phase:'prepared'};
 await atomicFile(journalFile(j.out),encoded(j));return j;
}
export async function publicationPhase(j:PublicationJournal,phase:PublicationJournal['phase']){j.phase=phase;await atomicFile(journalFile(j.out),encoded(j));}
export async function markRegistryPublication(j:PublicationJournal){const path=markerFile(j.registry);try{await lstat(path);refusal('Registry publication ownership marker already exists.');}catch(e:any){if(e.code!=='ENOENT')throw e;}await atomicFile(path,encoded({transactionId:j.transactionId,out:j.out,owner:j.owner}));}
export async function unmarkRegistryPublication(j:PublicationJournal){const path=markerFile(j.registry);const marker=JSON.parse((await readSafe(path,16384)).toString());if(canonical(marker)!==canonical({transactionId:j.transactionId,out:j.out,owner:j.owner}))refusal('Registry publication ownership changed.');await unlink(path);}
export interface RecoverPublicationInput {workspace:string;out:string;registry:string;transactionId:string;confirmOwnerStopped:true;}
export interface RecoveryResult extends Report {transactionId?:string;outcome?:'RESTORED_OLD'|'KEPT_OLD'|'KEPT_NEW'|'ABORTED_INITIAL';}
/** Explicit local process-crash recovery. Never steals a live/unknown lock, never publishes
 * staged assets with reconstituted authorization. All paths and bytes must match the journal.
 * This is not power-loss durability, distributed locking or a Windows crash certificate. */
export async function recoverPublication(input:RecoverPublicationInput):Promise<RecoveryResult>{
 let recoveryLock:string|undefined;let recoveryOwner:Record<string,unknown>|undefined;
 try{
  if(!input||input.confirmOwnerStopped!==true||!uuid(input.transactionId))refusal('Explicit owner-stop confirmation and exact transaction ID required.');
  const workspace=resolve(input.workspace),out=within(workspace,input.out),registry=resolve(input.registry);await requireDirectory(workspace);await requireDirectory(out+'.writer-lock');await requireDirectory(registry);
  let raw:Buffer;try{raw=await readSafe(journalFile(out),65536);}catch(e:any){if(e.code==='ENOENT')refusal('No complete transaction journal; unknown lock is preserved for manual inspection.');throw e;}const j=JSON.parse(raw.toString()) as PublicationJournal;
  if(Object.keys(j).some(k=>!['version','transactionId','owner','workspace','out','registry','staging','backup','oldManifestSha256','newManifestSha256','phase','recoveryOutcome'].includes(k))||Object.keys(j.owner??{}).some(k=>!['pid','host','platform','bootId'].includes(k))||j.version!==1||j.transactionId!==input.transactionId||j.workspace!==workspace||j.out!==out||j.registry!==registry||!j.owner||!Number.isInteger(j.owner.pid)||j.owner.pid<2||!['prepared','old-moved','published'].includes(j.phase)||!hash(j.newManifestSha256)||(j.oldManifestSha256!==null&&!hash(j.oldManifestSha256)))refusal('Journal identity is invalid or mismatched.');
  if(j.staging!==out+'.staging-'+j.transactionId||j.backup!==out+'.previous-'+j.transactionId)refusal('Journal output paths do not match transaction identity.');
  if(j.recoveryOutcome!==undefined&&!['RESTORED_OLD','KEPT_OLD','KEPT_NEW','ABORTED_INITIAL'].includes(j.recoveryOutcome))refusal('Invalid persisted recovery outcome.');
  if(j.owner.host!==hostname()||j.owner.platform!==process.platform||!j.owner.bootId||j.owner.bootId!==boot())refusal('Recovery requires the same verified host boot; unknown/rebooted environments need manual inspection.');
  try{process.kill(j.owner.pid,0);refusal('Journal owner is still alive; recovery cannot steal its lock.');}catch(e:any){if(e.code!=='ESRCH')throw e;}
  const names=await readdir(out+'.writer-lock');if(names.length!==1||names[0]!=='transaction.json')refusal('Unknown output-lock content; do not remove it.');
  recoveryLock=out+'.recovery-lock';try{await mkdir(recoveryLock,{mode:0o700});}catch(e:any){recoveryLock=undefined;if(e.code==='EEXIST')refusal('Another recovery or stale recovery lock exists.');throw Error('E_SYSTEM_IO: Cannot acquire recovery exclusion.');}
  recoveryOwner={recoveryId:randomUUID(),transactionId:j.transactionId,pid:process.pid,host:hostname(),bootId:boot()};await atomicFile(join(recoveryLock,'owner.json'),encoded(recoveryOwner));
  // Acquire only after owner-death verification; the original writer lock remains in place.
  if(!raw.equals(await readSafe(journalFile(out),65536)))refusal('Journal changed while acquiring recovery exclusion.');
  let ownedRegistryLock=false,registryLockExists=true;
  try{await lstat(join(registry,'.writer-lock'));}catch(e:any){if(e.code==='ENOENT')registryLockExists=false;else throw e;}
  if(registryLockExists){await requireDirectory(join(registry,'.writer-lock'));const entries=await readdir(join(registry,'.writer-lock'));if(entries.length!==1||entries[0]!=='publication.json')refusal('Registry lock has no matching publication ownership; do not steal it.');const marker=JSON.parse((await readSafe(markerFile(registry),16384)).toString());if(canonical(marker)!==canonical({transactionId:j.transactionId,out:j.out,owner:j.owner}))refusal('Registry lock belongs to another transaction.');ownedRegistryLock=true;}
  const inspect=async(path:string)=>{try{await lstat(path);}catch(e:any){if(e.code==='ENOENT')return null;throw e;}await requireDirectory(path);const result=await validatePackage(path);if(result.status!=='PASS')refusal('A transaction package is damaged or unknown; no automatic deletion.');return digest(await readSafe(join(path,'asset-manifest.json')));};
  const current=await inspect(out),staged=await inspect(j.staging),previous=await inspect(j.backup);
  if((staged!==null&&staged!==j.newManifestSha256)||(previous!==null&&(j.oldManifestSha256===null||previous!==j.oldManifestSha256)))refusal('Staged/previous bytes differ from transaction receipt.');
  let outcome:NonNullable<RecoveryResult['outcome']>;let restoreOld=false;
  if(j.oldManifestSha256!==null&&current===j.oldManifestSha256&&previous===null&&staged===j.newManifestSha256)outcome=j.recoveryOutcome==='RESTORED_OLD'?'RESTORED_OLD':'KEPT_OLD';
  else if(current===j.newManifestSha256&&staged===null)outcome=(j.recoveryOutcome==='KEPT_OLD'||j.recoveryOutcome==='RESTORED_OLD')&&current===j.oldManifestSha256?j.recoveryOutcome:'KEPT_NEW';
  else if(j.oldManifestSha256!==null&&current===j.oldManifestSha256&&previous===null&&staged===null&&(j.recoveryOutcome==='KEPT_OLD'||j.recoveryOutcome==='RESTORED_OLD'))outcome=j.recoveryOutcome;
  else if(current===null&&j.oldManifestSha256!==null&&previous===j.oldManifestSha256&&staged===j.newManifestSha256){outcome='RESTORED_OLD';restoreOld=true;}
  else if(current===null&&j.oldManifestSha256===null&&previous===null&&(staged===j.newManifestSha256||(staged===null&&j.recoveryOutcome==='ABORTED_INITIAL')))outcome='ABORTED_INITIAL';
  else refusal('Unknown publication state; preserve all files for manual inspection.');
  if(j.recoveryOutcome!==undefined&&j.recoveryOutcome!==outcome)refusal('Physical state conflicts with persisted recovery intent.');
  j.recoveryOutcome=outcome;await atomicFile(journalFile(out),encoded(j));
  if(restoreOld)await rename(j.backup,out);
  // Only the verified transaction-owned candidates may be removed. No broad directory glob.
  if(staged!==null)await rm(j.staging,{recursive:true});if(previous!==null&&outcome!=='RESTORED_OLD')await rm(j.backup,{recursive:true});
  if(ownedRegistryLock){await unmarkRegistryPublication(j);await rmdir(join(registry,'.writer-lock'));}
  await unlink(journalFile(out));await rmdir(out+'.writer-lock');
  return {...report([]),transactionId:j.transactionId,outcome,artifactPaths:outcome==='ABORTED_INITIAL'?[]:[out]};
 }catch(e){const message=e instanceof Error?e.message:'Recovery failed';return report([diagnostic(message.match(/^E_[A-Z_]+/)?.[0]??'E_BUILD_RECOVERY_REQUIRED','',message)]);}
 finally{if(recoveryLock&&recoveryOwner)try{const names=await readdir(recoveryLock);const owner=JSON.parse((await readSafe(join(recoveryLock,'owner.json'),16384)).toString());if(names.length===1&&names[0]==='owner.json'&&canonical(owner)===canonical(recoveryOwner)){await unlink(join(recoveryLock,'owner.json'));await rmdir(recoveryLock);}}catch{/* Preserve unknown or damaged recovery exclusion for explicit inspection. */}}
}
