// Deliberately narrow M0 validator; not the full M1/M2 validator or runtime adapter.
export function spriteFile(manifest,slot){
 const binding=manifest?.bindings?.[slot];
 if(!binding||binding.kind!=='sprite2d'||binding.files?.length!==1)throw new Error('E_REFERENCE_MISSING');
 const path=binding.files[0];
 if(!/^assets\/[a-z0-9.-]+\.png$/.test(path))throw new Error('E_SECURITY_PATH_ESCAPE');
 const matches=manifest.files.filter(file=>file.path===path);
 if(matches.length!==1||!Number.isSafeInteger(matches[0].bytes)||matches[0].bytes<1||! /^[a-f0-9]{64}$/.test(matches[0].sha256))throw new Error('E_SCHEMA_INVALID');
 return {binding,file:matches[0],path};
}
export async function verifyBytes(bytes,file,subtle){
 const actual=Array.from(new Uint8Array(await subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
 if(bytes.byteLength!==file.bytes||actual!==file.sha256)throw new Error('E_LOCK_DRIFT');
}
