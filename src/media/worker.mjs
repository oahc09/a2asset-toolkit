import {readFileSync,writeFileSync} from 'node:fs';
const [mode,input,output]=process.argv.slice(2);
try{
 if(mode==='webp'){
  const {default:sharp}=await import('sharp');sharp.cache(false);sharp.concurrency(1);
  const image=sharp(input,{limitInputPixels:2048*2048,failOn:'warning',animated:false});const meta=await image.metadata();
  if(meta.format!=='webp'||(meta.pages??1)!==1||meta.width>2048||meta.height>2048||meta.icc)throw Error('unsupported WebP');
  const {data,info}=await image.ensureAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
  if(data.length>16*1024*1024)throw Error('pixel budget');
  await sharp(data,{raw:info}).png({compressionLevel:9,adaptiveFiltering:false,palette:false}).toFile(output);
  process.send?.({ok:true,metadata:{width:info.width,height:info.height,decodedBytes:data.length,toolchain:sharp.versions}});
 }else if(mode==='woff2'){
  const fontkit=await import('fontkit');const bytes=readFileSync(input);if(bytes.toString('ascii',0,4)!=='wOF2'||bytes.length<48||bytes.readUInt32BE(8)!==bytes.length||bytes.readUInt32BE(16)>16*1024*1024)throw Error('WOFF2 header budget');
  const font=fontkit.create(bytes);if(!font||!Number.isSafeInteger(font.numGlyphs)||font.numGlyphs>8192||!font.characterSet||font.characterSet.length>16384)throw Error('font budget');
  // Force glyph outline decompression, not just reading a magic/header/name table.
  let commandCount=0;for(let i=0;i<font.numGlyphs;i++){commandCount+=font.getGlyph(i).path.commands.length;if(commandCount>1000000)throw Error('outline budget');}
  writeFileSync(output,bytes);process.send?.({ok:true,metadata:{family:font.familyName,decodedBytes:bytes.readUInt32BE(16),numGlyphs:font.numGlyphs,characterSet:font.characterSet,outlineCommands:commandCount,fontkitVersion:'2.0.4',browserGlyphRendering:'NOT_RUN'}});
 }else throw Error('unsupported worker');
}catch{process.send?.({ok:false});process.exitCode=1;}finally{process.disconnect?.();}
