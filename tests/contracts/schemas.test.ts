import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contractNames, validateContract } from '../../src/contracts/validate.js';
const files: Record<string,string> = {'asset-definition':'asset-definition-UNPUBLISHABLE','asset-binding':'asset-binding-SCHEMA_ONLY','asset-lock':'asset-lock-SCHEMA_ONLY','bundle-manifest':'bundle-manifest-SCHEMA_ONLY'};
for (const name of contractNames) {
 const input=JSON.parse(readFileSync(new URL(`../../examples/${files[name]??name}.json`,import.meta.url),'utf8'));
 test(`${name}: supplied structural positive (not production approval)`,()=>assert.equal(validateContract(name,input).status,'PASS'));
 test(`${name}: missing schemaVersion rejected`,()=>{const copy=structuredClone(input);delete copy.schemaVersion;assert.equal(validateContract(name,copy).status,'FAIL');});
 test(`${name}: unknown property rejected`,()=>assert.equal(validateContract(name,{...input,unreviewedExtension:true}).status,'FAIL'));
}
