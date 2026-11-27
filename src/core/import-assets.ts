import {AssetRegistry} from '../registry/index.js';
import {inspectDirectory,inspectArchive} from '../importer/index.js';
import {validateContract,report,diagnostic,type Report} from '../contracts/validate.js';
export async function importAssets(input:{path:string;definition:unknown;registry:string;signal?:AbortSignal}):Promise<Report>{
 const definition=input.definition;
   const schema=validateContract('asset-definition',definition);if(schema.status!=='PASS')return schema;
   const def=definition as Record<string,any>;
   const mimeFormats:Record<string,string>={'image/png':'png','image/webp':'webp','application/json':'json','audio/wav':'wav','audio/ogg':'ogg','audio/mpeg':'mp3','font/woff2':'woff2'};
   const allowFormats=[...new Set(['png','json','txt',...[...def.sources,...(def.variants??[])].map((s:{mediaType?:string;path:string})=>s.mediaType?mimeFormats[s.mediaType]:({png:'png',webp:'webp',wav:'wav',ogg:'ogg',mp3:'mp3',woff2:'woff2',json:'json'} as Record<string,string>)[s.path.split('.').pop()!.toLowerCase()]).filter(Boolean)])] as any;
   const inspectOptions={...input,allowFormats};
   const result=input.path.toLowerCase().endsWith('.zip')?await inspectArchive(input.path,inspectOptions):await inspectDirectory(input.path,inspectOptions);
   if(result.status!=='PASS')return {...result,files:undefined} as Report;
   for(const f of [...def.sources,...(def.variants??[])]){
    const m=result.metadata.find(m=>m.path===f.path);
    if(!m)return report([diagnostic('E_REFERENCE_MISSING','/sources',`Missing inspected file ${f.path}`)]);
    if((f.mediaType&&f.mediaType!==m.mediaType)||(f.width!==undefined&&f.width!==m.width)||(f.height!==undefined&&f.height!==m.height))return report([diagnostic('E_SECURITY_UNSAFE_CONTENT','/sources','Declared media type or dimensions differ from decoded source')]);
   }
   if(def.geometry?.pixelSize){const m=result.metadata.find(m=>m.path===def.sources[0].path);if(m?.width!==def.geometry.pixelSize[0]||m?.height!==def.geometry.pixelSize[1])return report([diagnostic('E_SECURITY_UNSAFE_CONTENT','/geometry/pixelSize','Geometry differs from decoded source')]);}
   if(input.signal?.aborted)return report([diagnostic('E_CANCELLED','','Operation cancelled')]);
   const registry=new AssetRegistry(input.registry);
   const names=[...def.sources,...(def.variants??[]),{path:def.provenance.licenseEvidencePath}].map((f:{path:string})=>f.path);
   const selected=new Map<string,Uint8Array>();for(const name of names){const bytes=result.files.get(name);if(bytes)selected.set(name,bytes);}
   const imported=registry.importDefinition(definition,selected);
   if(imported.status!=='PASS'||!imported.assetKey)return imported;
   return imported.record?.state==='imported'?registry.transition(imported.assetKey,'inspected'):imported;
}
