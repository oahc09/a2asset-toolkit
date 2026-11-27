// PNG Third Edition, §11.3.2: canonical legacy sRGB metadata.
// No color transformation is performed by the frozen PNG processor.
const srgbChromaticities=[31270,32900,64000,33000,30000,60000,15000,6000];
const sRGBChunks=new Set(['sRGB','gAMA','cHRM']);
const unsupported=new Set(['iCCP','cICP','acTL','fcTL','fdAT']);
export class PngAdmissionError extends Error {constructor(readonly code:string,message:string){super(message);}}
function refusal(code:string,message:string):never{throw new PngAdmissionError(code,message);}
function crc32(bytes:Buffer):number{
 let crc=0xffffffff;
 for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}

export function assertPngColorAdmission(source:Uint8Array):void{
 const b=Buffer.from(source.buffer,source.byteOffset,source.byteLength);
 const bad=(message:string):never=>refusal('E_SECURITY_UNSAFE_CONTENT',message);
 if(b.length<33||b.toString('hex',0,8)!=='89504e470d0a1a0a')bad('Not PNG');
 const seen=new Set<string>();let afterColor=false;
 for(let off=8;off+12<=b.length;){
  const n=b.readUInt32BE(off),type=b.toString('latin1',off+4,off+8),start=off+8;
  if(n>b.length-off-12)bad('PNG chunk overflow');
  if(unsupported.has(type))refusal('E_PROCESSOR_UNSUPPORTED',type+' requires a separate certified PNG processor');
  if(sRGBChunks.has(type)){
   const size=type==='sRGB'?1:type==='gAMA'?4:32;
   if(n!==size||afterColor||off<33||seen.has(type)||crc32(b.subarray(off+4,start+n))!==b.readUInt32BE(start+n))bad('Malformed PNG '+type);
   seen.add(type);
   if(type==='sRGB'&&b[start]>3)bad('Invalid PNG sRGB rendering intent');
   if(type==='gAMA'&&b.readUInt32BE(start)===0)bad('Invalid PNG gAMA value');
   if(type==='gAMA'&&b.readUInt32BE(start)!==45455)refusal('E_PROCESSOR_UNSUPPORTED','Non-sRGB transfer needs explicit color conversion');
   if(type==='cHRM'&&srgbChromaticities.some((value,i)=>b.readUInt32BE(start+i*4)!==value))refusal('E_PROCESSOR_UNSUPPORTED','Non-sRGB chromaticities need explicit color conversion');
  }
  if(type==='PLTE'||type==='IDAT')afterColor=true;
  off+=n+12;
  if(type==='IEND'){if(off!==b.length)bad('PNG trailing data');return;}
 }
 bad('PNG missing IEND');
}
