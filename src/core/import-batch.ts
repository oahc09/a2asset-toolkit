import {importAssets} from './import-assets.js';
import {diagnostic,report,type Report} from '../contracts/validate.js';
export interface BatchImportJob {id:string;path:string;definition:unknown;}
export interface BatchImportInput {registry:string;jobs:readonly BatchImportJob[];signal?:AbortSignal;stopOnError?:boolean;}
export interface BatchImportItem {id:string;outcome:'IMPORTED'|'FAILED'|'CANCELLED'|'NOT_RUN';report:Report;assetKey?:string;state?:string;}
export interface BatchImportReport extends Report {items:BatchImportItem[];summary:{total:number;imported:number;failed:number;cancelled:number;notRun:number};}
export const MAX_BATCH_IMPORT_JOBS=64;
/** Sequential, partial-commit imports. Never approves, publishes, or removes prior assets.
 * Validate the complete job envelope before IO; individual definitions retain the single-import
 * validator. stopOnError=false continues ordinary failures, never cancellation. */
export async function importBatch(input:BatchImportInput):Promise<BatchImportReport>{
 const items:BatchImportItem[]=[];
 const summary={total:0,imported:0,failed:0,cancelled:0,notRun:0};
 const result=(r:Report):BatchImportReport=>({...r,items,summary});
 let jobs:BatchImportJob[];let registry:string;let stopOnError:boolean;
 try{
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['jobs','registry','signal','stopOnError'].includes(k))||typeof input.registry!=='string'||!input.registry.trim()||!Array.isArray(input.jobs)||input.jobs.length<1||input.jobs.length>MAX_BATCH_IMPORT_JOBS||(input.stopOnError!==undefined&&typeof input.stopOnError!=='boolean'))throw Error('Expected registry path and 1..64 explicit jobs; stopOnError must be boolean.');
  if(input.signal!==undefined&&!(input.signal instanceof AbortSignal))throw Error('signal must be an AbortSignal.');
  const ids=new Set<string>();
  for(const job of input.jobs){if(!job||typeof job!=='object'||Array.isArray(job)||Object.keys(job).some(k=>!['id','path','definition'].includes(k))||typeof job.id!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(job.id)||ids.has(job.id)||typeof job.path!=='string'||!job.path.trim()||!Object.hasOwn(job,'definition'))throw Error('Each job requires a unique safe id, explicit source path and definition.');ids.add(job.id);}
  // Snapshot caller-owned job/definition objects before the first asynchronous operation.
  jobs=structuredClone(input.jobs);registry=input.registry;stopOnError=input.stopOnError??true;summary.total=jobs.length;
 }catch(e){return result(report([diagnostic('E_SCHEMA_INVALID','/jobs',e instanceof Error?e.message:'Invalid batch envelope.')]));}
 const signal=input.signal;
 let stopped=false;
 for(const job of jobs){
  if(stopped){const r=report([diagnostic('E_BATCH_NOT_RUN','','Not run after an earlier failure or cancellation.')]);r.status='BLOCKED';items.push({id:job.id,outcome:'NOT_RUN',report:r});summary.notRun++;continue;}
  let imported:Report&{assetKey?:string;record?:{state?:string}};
  if(signal?.aborted)imported=report([diagnostic('E_CANCELLED','','Batch cancelled before starting this job.')]);
  else try{imported=await importAssets({path:job.path,definition:job.definition,registry,signal});}catch(e){imported=report([diagnostic('E_IMPORT_IO','',e instanceof Error?e.message:'Unexpected import failure.')]);}
  // Do not rewrite a committed success as cancelled if the signal arrives after its commit.
  const cancelled=imported.status!=='PASS'&&(signal?.aborted||imported.diagnostics.some(d=>d.code==='E_CANCELLED'));
  const outcome=imported.status==='PASS'?'IMPORTED':cancelled?'CANCELLED':'FAILED';
  const safeReport:Report={schemaVersion:imported.schemaVersion,status:imported.status,diagnostics:imported.diagnostics,artifactPaths:imported.artifactPaths};
  if(cancelled&&!safeReport.diagnostics.some(d=>d.code==='E_CANCELLED'))safeReport.diagnostics=[...safeReport.diagnostics,diagnostic('E_CANCELLED','','Batch cancellation observed.')];
  items.push({id:job.id,outcome,report:safeReport,...(imported.assetKey?{assetKey:imported.assetKey}:{}),...(imported.record?.state?{state:imported.record.state}:{})});
  if(outcome==='IMPORTED')summary.imported++;else if(outcome==='CANCELLED')summary.cancelled++;else summary.failed++;
  if(cancelled||(outcome==='FAILED'&&stopOnError))stopped=true;
 }
 const diagnostics=items.flatMap(item=>item.report.diagnostics.map(d=>({...d,path:`/jobs/${item.id}${d.path}`})));
 const aggregate=report(diagnostics);if(items.some(item=>item.outcome!=='IMPORTED'))aggregate.status='FAIL';return result(aggregate);
}
