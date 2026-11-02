import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const p=JSON.parse(readFileSync(new URL('../../fixtures/benchmarks/platformer-input.json',import.meta.url),'utf8'));
test('BG04 independent fixture has bounded tile indices and explicit frame requirements',()=>{for(const layer of p.layers)for(const row of layer.rows)for(const tile of row)assert.ok(Number.isInteger(tile)&&tile>=0&&tile<p.tilesetCount);assert.deepEqual(p.player.requiredStates,['idle','run','jump','fall']);assert.deepEqual(p.player.pivot,[0.5,1]);});
