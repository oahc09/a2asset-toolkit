// Use UTF-16 code-unit order (like the canonical JSON key sort), never locale collation.
export function compareText(a:string,b:string):number {
 return a<b?-1:a>b?1:0;
}
