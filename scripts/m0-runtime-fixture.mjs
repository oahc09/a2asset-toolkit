// Deterministic hand-specified geometry, not AI-generated artwork. Preview only.
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../examples/m0-runtime/', import.meta.url);
const hash = b => createHash('sha256').update(b).digest('hex');
function crc(b) { let c = 0xffffffff; for (const v of b) { c ^= v; for(let i=0;i<8;i++) c=(c>>>1)^((c&1)?0xedb88320:0); } return (c^0xffffffff)>>>0; }
function chunk(type,data) {const t=Buffer.from(type),n=Buffer.alloc(4),c=Buffer.alloc(4);n.writeUInt32BE(data.length);c.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([n,t,data,c]);}
const head=Buffer.alloc(13);head.writeUInt32BE(32,0);head.writeUInt32BE(32,4);head[8]=8;head[9]=6;
const rows=Buffer.alloc(32*(1+32*4));
for(let y=0;y<32;y++) for(let x=0;x<32;x++){const p=y*129+1+x*4; const inside=Math.abs(x-15.5)<y*.42+2 && y<29; rows.set(inside?[40,220,180,255]:[0,0,0,0],p);}
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
await mkdir(new URL('assets/',root),{recursive:true});await writeFile(new URL('assets/player.png',root),png);
const manifest={schemaVersion:'1.0.0',gameId:'arcade-shooter-m0',profileId:'webgl2-preview',buildFingerprint:hash(png),bindings:{'player.main':{assetId:'m0.geometry-player',kind:'sprite2d',files:['assets/player.png'],pivot:[.5,.5],logicalSize:[4,4],placeholder:true}},files:[{path:'assets/player.png',sha256:hash(png),bytes:png.length,mediaType:'image/png'}]};
await writeFile(new URL('asset-manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
