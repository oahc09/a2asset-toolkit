import {createHash} from 'node:crypto';
import {processAsset,type ProcessorResult} from './index.js';
import {inspectMediaBytes,MediaFailure,type MediaOptions} from '../media/inspect.js';
import {diagnostic,validateContract} from '../contracts/validate.js';
export type {MediaOptions} from '../media/inspect.js';
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
export async function processMediaAsset(definition:Record<string,any>,files:Map<string,Uint8Array>,options:MediaOptions={}):Promise<ProcessorResult>{
 const result:ProcessorResult={schemaVersion:'1.0.0',status:'PASS',diagnostics:[],artifactPaths:[],files:new Map(),metadata:{processorVersion:'media-1.0.0'}};
 try{
  const schema=validateContract('asset-definition',definition);if(schema.status!=='PASS')return{...result,...schema};
  const trusted=(s:any)=>{const bytes=files.get(s.path);if(!bytes||sha(bytes)!==s.sha256)throw new MediaFailure('E_LOCK_DRIFT','Missing or altered media source');return bytes;};
  if(['audio','font'].includes(definition.kind)){
   if(definition.sources.length!==1)throw new MediaFailure('E_PROCESSOR_UNSUPPORTED','Single source required for audio/font');const source=definition.sources[0];const formats:Record<string,string>={'audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg','audio/mpeg':'mp3','font/woff2':'woff2'};const ext=formats[source.mediaType];if(!ext||(definition.kind==='font')!==(ext==='woff2'))throw new MediaFailure('E_PROCESSOR_UNSUPPORTED','Kind/media mismatch');
   const inspected=await inspectMediaBytes(trusted(source),source.mediaType,options);if(definition.audioInfo){for(const key of ['sampleRate','channels','durationMs'])if(definition.audioInfo[key]!==undefined&&definition.audioInfo[key]!==Math.round(inspected.metadata[key]))throw new MediaFailure('E_SCHEMA_INVALID','Declared audio metadata differs from full decoded media');}if(definition.fontInfo?.family&&definition.fontInfo.family!==inspected.metadata.family)throw new MediaFailure('E_SCHEMA_INVALID','Declared font family differs from decoded font');const path=`assets/${definition.assetId}-${definition.version}.${ext}`;if(definition.kind==='audio'&&definition.audioInfo){for(const field of ['sampleRate','channels','durationMs'])if(definition.audioInfo[field]!==undefined&&Math.abs(definition.audioInfo[field]-inspected.metadata[field])>(field==='durationMs'?1:0))throw new MediaFailure('E_SCHEMA_INVALID','Declared audio metadata differs from full decoded PCM');}if(definition.kind==='font'&&definition.fontInfo?.family&&definition.fontInfo.family!==inspected.metadata.family)throw new MediaFailure('E_SCHEMA_INVALID','Declared font family differs from decoded font');result.files.set(path,inspected.bytes);result.binding={assetId:definition.assetId,kind:definition.kind,files:[path],...(definition.kind==='audio'?{audio:{sampleRate:inspected.metadata.sampleRate,channels:inspected.metadata.channels}}:{})};result.metadata={...result.metadata,...inspected.metadata,outputHashes:{[path]:sha(inspected.bytes)}};return result;
  }
  if(!definition.sources.some((s:any)=>s.mediaType==='image/webp'))return processAsset(definition,files,options);
  const normalized=structuredClone(definition),map=new Map(files),toolchain=[];let total=0;
  for(let i=0;i<normalized.sources.length;i++){const source=normalized.sources[i];if(source.mediaType!=='image/webp')continue;const inspected=await inspectMediaBytes(trusted(source),'image/webp',options);total+=inspected.metadata.decodedBytes;if(total>(options.maxDecodedBytes??16*1024*1024))throw new MediaFailure('E_BUILD_BUDGET','WebP decoded budget exceeded');const path=`normalized/frame-${String(i).padStart(6,'0')}.png`;normalized.sources[i]={...source,path,sha256:sha(inspected.bytes),mediaType:'image/png'};map.set(path,inspected.bytes);toolchain.push(inspected.metadata.toolchain);}
  const png=processAsset(normalized,map,options);png.metadata.webpToolchain=toolchain;png.metadata.originalSourceHashes=definition.sources.map((s:any)=>s.sha256);return png;
 }catch(e){result.status='FAIL';result.files.clear();result.binding=undefined;result.diagnostics.push(diagnostic(e instanceof MediaFailure?e.code:'E_PROCESSOR_DECODE','',e instanceof Error?e.message:'Media processing failed','Supply licensed supported media within the frozen limits.'));return result;}
}

export const MEDIA_PROCESSOR_VERSION='1.0.0';
/** Only probe codecs used by this asset; a PNG build never needs ffmpeg/fontkit. */
export async function mediaToolchainFor(definition:Record<string,any>):Promise<Record<string,unknown>>{
 const types=new Set((definition.sources??[]).map((s:any)=>s.mediaType));
 const toolchain:Record<string,unknown>={processorId:'media-1.0.0',processorVersion:MEDIA_PROCESSOR_VERSION};
 if(!types.has('image/webp')&&definition.kind!=='audio'&&definition.kind!=='font')return toolchain;
 const {readFile}=await import('node:fs/promises');toolchain.workerSha256=sha(await readFile(new URL('../media/worker.mjs',import.meta.url)));
 if(types.has('image/webp')){const{default:sharp}=await import('sharp');toolchain.sharp=sharp.versions;}
 if(definition.kind==='font'){
  const{createRequire}=await import('node:module');const{dirname,join}=await import('node:path');const require=createRequire(import.meta.url);const path=join(dirname(dirname(require.resolve('fontkit'))),'package.json');const pkg=JSON.parse(await readFile(path,'utf8'));if(pkg.name!=='fontkit')throw new MediaFailure('E_PROCESSOR_ENVIRONMENT','Cannot verify fontkit toolchain');toolchain.fontkit=pkg.version;
 }
 if(definition.kind==='audio'){
  const{execFile}=await import('node:child_process');const{promisify}=await import('node:util');const execute=promisify(execFile);
  for(const command of ['ffmpeg','ffprobe']){const r=await execute(command,['-version'],{timeout:5000,killSignal:'SIGKILL',maxBuffer:1024*1024});toolchain[command]=r.stdout.trim();}
 }
 return toolchain;
}
