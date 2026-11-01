import {importAssets} from '../core/import-assets.js';
import {resolve} from 'node:path';
import {resolveAssets} from '../resolver/index.js';
import {buildBundle,validatePackage,capabilities} from '../builder/index.js';
import {atomicFile,within} from '../builder/io.js';
import {readFile,lstat} from 'node:fs/promises';
import {AssetRegistry,type ReviewRecord,type AssetState} from '../registry/index.js';
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
  if(a.command==='validate'){
   if(a.positional.length!==1)throw Error('validate requires one package directory');
   return validatePackage(a.positional[0],typeof a.options.profile==='string'?await readJson(a.options.profile) as Record<string,any>:undefined);
  }
  if(a.command==='resolve'||a.command==='build'){
   if(a.positional.length!==1||typeof a.options.registry!=='string'||typeof a.options.visual!=='string'||typeof a.options.profile!=='string')throw Error('resolve/build requires request JSON, --registry, --visual and --profile');
   const input:Record<string,any>={request:await readJson(a.positional[0]),visual:await readJson(a.options.visual),profile:await readJson(a.options.profile)};
   for(const key of ['bindings','theme','genre','themes'])if(typeof a.options[key]==='string')input[key]=await readJson(a.options[key] as string);
   if(typeof a.options['preview-config']==='string'){
    const config=await readJson(a.options['preview-config']) as any;
    if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(k=>!['fallbacks','approvedModules'].includes(k))||!config.fallbacks||typeof config.fallbacks!=='object'||Array.isArray(config.fallbacks)||!Array.isArray(config.approvedModules)||config.approvedModules.some((id:unknown)=>id!=='geometry.triangle-v1')||Object.values(config.fallbacks).some(id=>id!=='geometry.triangle-v1'))throw Error('Preview config permits only explicit geometry.triangle-v1 fallback mappings');
    input.previewFallbacks=config.fallbacks;input.approvedPreviewModules=config.approvedModules;
   }
   const registry=new AssetRegistry(a.options.registry);
   if(a.command==='build'){
    if(typeof a.options.out!=='string')throw Error('build requires --out within current working directory');
    return buildBundle({registry,resolve:input as any,workspace:process.cwd(),out:a.options.out,cacheDir:typeof a.options.cache==='string'?a.options.cache:undefined,signal:options.signal,gameSpec:typeof a.options.game==='string'?await readJson(a.options.game):undefined});
   }
   const records=registry.list();if(records.status!=='PASS')return records;
   const result=resolveAssets({...input,registry:records.records!,processorCapabilities:capabilities} as any);
   if(result.status==='PASS'&&typeof a.options.out==='string'){const output=within(process.cwd(),a.options.out);await atomicFile(output,Buffer.from(JSON.stringify(result.assetBinding,null,2)+'\n'));result.artifactPaths.push(output);}
   return result;
  }
  if(a.command==='import'){
   if(a.positional.length!==1||typeof a.options.definition!=='string'||typeof a.options.registry!=='string')throw Error('import requires one directory or ZIP, --definition JSON and --registry directory');
   return importAssets({path:a.positional[0],definition:await readJson(a.options.definition),registry:a.options.registry,signal:options.signal});
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
