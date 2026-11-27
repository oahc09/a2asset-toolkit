import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
try {
 const decoded=PNG.sync.read(readFileSync(process.argv[2]),{checkCRC:true});
 process.send?.({ok:true,width:decoded.width,height:decoded.height});
} catch {process.send?.({ok:false});}
process.disconnect?.();
