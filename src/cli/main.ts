import {readFile,lstat} from 'node:fs/promises';
import {AssetRegistry,type ReviewRecord,type AssetState} from '../registry/index.js';
import {inspectDirectory,inspectArchive} from '../importer/index.js';
import {parseArguments} from './arguments.js';
import {validateContract,diagnostic,report,type Report} from '../contracts/validate.js';
export function exitCode(r:Report):number {
 if(r.status==='PASS')return 0;
 if(r.diagnostics.some(d=>/CANCEL/.test(d.code)))return 130;
 if(r.diagnostics.some(d=>/ENVIRONMENT|SYSTEM|UNSUPPORTED_COMMAND|REGISTRY_IO|IMPORT_IO|IMPORT_TIMEOUT|REGISTRY_BUSY/.test(d.code)))return 5;
 if(r.diagnostics.some(d=>/LICENSE|RIGHTS|SECURITY|STATE_TRANSITION/.test(d.code)))return 3;
 if(r.diagnostics.some(d=>/BUILD|PROCESSOR/.test(d.code)))return 4;
 return 2;
}
export async function readJson(path:string):Promise<unknown>{
 const st=await lstat(path);if(!st.isFile()||st.isSymbolicLink()||st.size>2*1024*1024)throw Error('JSON input must be a regular nonsymlink file ≤ 2 MiB');
 return JSON.parse(await readFile(path,'utf8'));
}
export async function run(argv:readonly string[], options:{signal?:AbortSignal}={}):Promise<Report>{
 try {
  if(options.signal?.aborted)return report([diagnostic('E_CANCELLED','','Operation cancelled')]);
  const a=parseArguments(argv);
  if(a.command==='help')return {...report([]),help:'a2asset inspect <request.json> --json; import <directory|zip> --definition <json> --registry <path>; registry list|get|approve|publish|quarantine|deprecate ...'} as Report;
  if(a.command==='inspect'){
   if(a.positional.length!==1)throw Error('inspect requires exactly one request JSON');
   return validateContract('game-asset-request',await readJson(a.positional[0]));
  }
  if(a.command==='import'){
   if(a.positional.length!==1||typeof a.options.definition!=='string'||typeof a.options.registry!=='string')throw Error('import requires one directory or ZIP, --definition JSON and --registry directory');
   const definition=await readJson(a.options.definition);
   const schema=validateContract('asset-definition',definition);if(schema.status!=='PASS')return schema;
   const def=definition as Record<string,any>;
   const result=a.positional[0].toLowerCase().endsWith('.zip')?await inspectArchive(a.positional[0],options):await inspectDirectory(a.positional[0],options);
   if(result.status!=='PASS')return {...result,files:undefined} as Report;
   for(const f of [...def.sources,...(def.variants??[])]){
    const m=result.metadata.find(m=>m.path===f.path);
    if(!m)return report([diagnostic('E_REFERENCE_MISSING','/sources',`Missing inspected file ${f.path}`)]);
    if((f.mediaType&&f.mediaType!==m.mediaType)||(f.width!==undefined&&f.width!==m.width)||(f.height!==undefined&&f.height!==m.height))return report([diagnostic('E_SECURITY_UNSAFE_CONTENT','/sources','Declared media type or dimensions differ from decoded source')]);
   }
   if(def.geometry?.pixelSize){const m=result.metadata.find(m=>m.path===def.sources[0].path);if(m?.width!==def.geometry.pixelSize[0]||m?.height!==def.geometry.pixelSize[1])return report([diagnostic('E_SECURITY_UNSAFE_CONTENT','/geometry/pixelSize','Geometry differs from decoded source')]);}
   if(options.signal?.aborted)return report([diagnostic('E_CANCELLED','','Operation cancelled')]);
   const registry=new AssetRegistry(a.options.registry);
   const names=[...def.sources,...(def.variants??[]),{path:def.provenance.licenseEvidencePath}].map((f:{path:string})=>f.path);
   const selected=new Map<string,Uint8Array>();for(const name of names){const bytes=result.files.get(name);if(bytes)selected.set(name,bytes);}
   const imported=registry.importDefinition(definition,selected);
   if(imported.status!=='PASS'||!imported.assetKey)return imported;
   return imported.record?.state==='imported'?registry.transition(imported.assetKey,'inspected'):imported;
  }
  if(a.command==='registry'){
   if(typeof a.options.registry!=='string')throw Error('registry requires --registry directory');
   const registry=new AssetRegistry(a.options.registry),sub=a.positional[0],key=a.positional[1];
   if(sub==='list'){if(a.positional.length!==1)throw Error('list takes no asset key');return registry.list({kind:typeof a.options.kind==='string'?a.options.kind:undefined,role:typeof a.options.role==='string'?a.options.role:undefined,status:typeof a.options.status==='string'?a.options.status as AssetState:undefined});}
   if(a.positional.length!==2)throw Error('registry command requires exactly one assetId@version');
   if(sub==='get')return registry.get(key);
   const states:Record<string,AssetState>={approve:'approved',publish:'published',quarantine:'quarantined',deprecate:'deprecated'};
   if(!states[sub])throw Error('Unknown registry command');
   const review=typeof a.options['review-record']==='string'?await readJson(a.options['review-record']) as ReviewRecord:undefined;
   return registry.transition(key,states[sub],review);
  }
  return report([diagnostic('E_UNSUPPORTED_COMMAND' ,'',`Command ${a.command} is not implemented in this build`)]);
 }catch(e){return report([diagnostic('E_SCHEMA_INVALID','',e instanceof Error?e.message:'Invalid input')]);}
}
