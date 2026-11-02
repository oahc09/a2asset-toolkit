import * as native from 'node:path';
/** Pure path arithmetic; an injected path flavour is for compatibility tests, not filesystem emulation. */
export interface PathArithmetic {resolve(...paths:string[]):string;relative(from:string,to:string):string;isAbsolute(path:string):boolean;sep:string;}
function inside(root:string,candidate:string,paths:PathArithmetic):boolean{const relative=paths.relative(root,candidate);return relative===''||(!paths.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+paths.sep));}
export function pathsOverlap(a:string,b:string,paths:PathArithmetic=native):boolean{const left=paths.resolve(a),right=paths.resolve(b);return inside(left,right,paths)||inside(right,left,paths);}
export function resolveWithin(root:string,path:string,paths:PathArithmetic=native):string{const base=paths.resolve(root),candidate=paths.resolve(base,path);if(paths.relative(base,candidate)===''||!inside(base,candidate,paths))throw Error('E_SECURITY_PATH_ESCAPE: output must be below workspace');return candidate;}
