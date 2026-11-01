export interface Arguments { command: string; positional: string[]; options: Record<string,string|boolean>; }
const flags=new Set(['json','non-interactive']);
const values=new Set(['registry','definition','review-record','kind','role','status','out','visual','profile','bindings','theme','genre','game','cache','themes','preview-config']);
export function parseArguments(argv:readonly string[]):Arguments {
 const command=argv[0]??'help', positional:string[]=[],options:Record<string,string|boolean>={};
 for(let i=1;i<argv.length;i++){
  const a=argv[i];if(!a.startsWith('--')){positional.push(a);continue;}
  const k=a.slice(2);if(Object.hasOwn(options,k))throw Error(`Duplicate option --${k}`);
  if(flags.has(k)){options[k]=true;continue;}
  if(!values.has(k))throw Error(`Unknown option --${k}`);
  const v=argv[++i];if(!v||v.startsWith('--'))throw Error(`Missing value for --${k}`);options[k]=v;
 }
 return {command,positional,options};
}
