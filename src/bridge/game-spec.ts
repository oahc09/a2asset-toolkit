/** Game-design 0.1 -> A2Asset 1.0 display mapping, not a gameplay validator. */
export const SOURCE_REVISION = '637e383783123d97bc05b235f1a5be125a9faba1';
export const ARCHETYPES = ['sokoban', 'match3', 'merge2048', 'block_puzzle', 'falling_blocks', 'arcade_shooter'] as const;
export interface Diagnostic { code: string; severity: 'error'; path: string; message: string; remediation: string }
export interface SourceValidation { status: string; issues?: readonly { code?: string; path?: string; message?: string }[] }
export type SourceValidator = (spec: unknown) => SourceValidation;
export interface Slot { kind: 'sprite2d'; role: string; required: true; requiredStates: ['idle']; fallbackPolicy: 'none' }
export interface GameAssetRequest { schemaVersion: '1.0.0'; gameId: string; genre: string; slots: Record<string, Slot> }
export interface MappingResult { schemaVersion: '1.0.0'; status: 'PASS' | 'FAIL'; diagnostics: Diagnostic[]; artifactPaths: string[]; request?: GameAssetRequest }
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const ident = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
/**
 * Caller supplies the pinned upstream validateSpec(spec, registry). No runtime import,
 * IO, mutation, game generation, default rule injection, or network access occurs here.
 * Upstream validation is mandatory: this bridge must not certify gameplay itself.
 */
export function mapGameSpec(spec: unknown, validateSource: SourceValidator): MappingResult {
  const fail = (code: string, path: string, message: string): MappingResult => ({schemaVersion: '1.0.0', status: 'FAIL', artifactPaths: [], diagnostics: [{code, path, message, severity: 'error', remediation: 'Validate against the pinned game-design contract; add an explicit reviewed mapping for unsupported capabilities.'}]});
  if (!object(spec) || spec.schema_version !== '0.1') return fail('E_SOURCE_SCHEMA', '/schema_version', 'Only game-design schema_version 0.1 is mapped.');
  if (!object(spec.metadata) || typeof spec.metadata.id !== 'string' || !ident.test(spec.metadata.id) || spec.metadata.id.length > 128) return fail('E_SOURCE_ID', '/metadata/id', 'Source ID must already be a valid A2Asset ID; IDs are never silently rewritten.');
  if (!object(spec.game) || typeof spec.game.archetype !== 'string' || !ARCHETYPES.includes(spec.game.archetype as typeof ARCHETYPES[number])) return fail('E_UNSUPPORTED_CAPABILITY', '/game/archetype', 'No frozen mapping for this archetype.');
  const genre = spec.game.archetype;
  if (!object(spec.content) || spec.content.archetype !== genre || !object(spec.design) || spec.design.archetype !== genre) return fail('E_SOURCE_REFERENCE', '/content/archetype', 'Game, design and content archetypes must agree.');
  const extensions = spec.content.extensions;
  if (!object(extensions) || Object.keys(extensions).length !== 1 || !object(extensions[genre])) return fail('E_UNSUPPORTED_CAPABILITY', '/content/extensions', 'Exactly the corresponding archetype extension is mapped.');
  if (!object(spec.extensions) || Object.keys(spec.extensions).length !== 0) return fail('E_UNSUPPORTED_CAPABILITY', '/extensions', 'Custom extensions need a reviewed display mapping.');
  if (typeof validateSource !== 'function') return fail('E_SOURCE_VALIDATION_REQUIRED', '', 'The authoritative upstream validator is required.');
  let validation: SourceValidation;
  try { validation = validateSource(structuredClone(spec)); }
  catch { return fail('E_SOURCE_VALIDATION_FAILED', '', 'Authoritative source validation failed to execute.'); }
  if (!validation || validation.status !== 'PASS' || (validation.issues?.length ?? 0) > 0) return fail('E_SOURCE_INVALID', '', 'The authoritative upstream validator rejected the GameSpec.');
  const config = extensions[genre];
  const slots: Record<string, Slot> = {};
  const add = (slot: string, role: string) => { slots[slot] = {kind:'sprite2d', role, required:true, requiredStates:['idle'], fallbackPolicy:'none'}; };
  if (genre !== 'arcade_shooter') add('board.floor', 'tile.floor');
  switch (genre) {
    case 'sokoban':
      add('board.wall', 'tile.wall'); add('board.goal', 'tile.goal'); add('box.main', 'item.box'); add('player.main', 'actor.player'); break;
    case 'match3': {
      // Count comes from real refill color domain, not just colors visible initially.
      if (!Number.isInteger(config.colors) || Number(config.colors) < 1 || Number(config.colors) > 64) return fail('E_UNSUPPORTED_CAPABILITY', '/content/extensions/match3/colors', 'Display mapping supports 1..64 explicit color slots.');
      for (let i=0; i<Number(config.colors); i++) add(`gem.color-${i}`, 'item.gem');
      if (Array.isArray(config.blockers) && config.blockers.flat().some(Boolean)) add('board.blocker', 'obstacle.static');
      break;
    }
    case 'merge2048': add('tile.number', 'tile.number'); break;
    case 'block_puzzle': case 'falling_blocks': add('block.cell', 'tile.block'); break;
    case 'arcade_shooter':
      add('player.main','actor.player'); add('enemy.main','actor.enemy'); add('bullet.player','projectile.player');
      if (typeof config.enemyFireIntervalTicks === 'number' && config.enemyFireIntervalTicks > 0) add('bullet.enemy','projectile.enemy');
      break;
  }
  return {schemaVersion:'1.0.0', status:'PASS', diagnostics:[], artifactPaths:[], request:{schemaVersion:'1.0.0', gameId:spec.metadata.id, genre, slots}};
}
