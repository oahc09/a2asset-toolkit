import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {webcrypto} from 'node:crypto';
import {spriteFile,verifyBytes} from '../../examples/m0-runtime/manifest-check.mjs';
const manifest=JSON.parse(await readFile(new URL('../../examples/m0-runtime/asset-manifest.json',import.meta.url)));
test('M0 real PNG matches manifest',async()=>{const {file}=spriteFile(manifest,'player.main');await verifyBytes(await readFile(new URL('../../examples/m0-runtime/assets/player.png',import.meta.url)),file,webcrypto.subtle);});
test('M0 refuses missing slot',()=>assert.throws(()=>spriteFile(manifest,'missing'),/E_REFERENCE_MISSING/));
test('M0 refuses path escape',()=>{const m=structuredClone(manifest);m.bindings['player.main'].files=['../secret.png'];assert.throws(()=>spriteFile(m,'player.main'),/E_SECURITY_PATH_ESCAPE/);});
test('M0 refuses undeclared or duplicate files',()=>{const m=structuredClone(manifest);m.files=[];assert.throws(()=>spriteFile(m,'player.main'),/E_SCHEMA_INVALID/);m.files=[...manifest.files,...manifest.files];assert.throws(()=>spriteFile(m,'player.main'),/E_SCHEMA_INVALID/);});
test('M0 refuses altered bytes',async()=>{await assert.rejects(verifyBytes(new Uint8Array(3),manifest.files[0],webcrypto.subtle),/E_LOCK_DRIFT/);});
