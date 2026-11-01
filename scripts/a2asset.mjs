#!/usr/bin/env node
const {run,exitCode}=await import('../dist/src/cli/main.js');
const controller=new AbortController();
const cancel=()=>controller.abort();
process.on('SIGINT',cancel);process.on('SIGTERM',cancel);
try{
 const result=await run(process.argv.slice(2),{signal:controller.signal});
 process.stdout.write(JSON.stringify(result)+'\n');
 process.exitCode=exitCode(result);
}finally{process.off('SIGINT',cancel);process.off('SIGTERM',cancel);}
