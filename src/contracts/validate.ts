import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
export interface Diagnostic { code: string; severity: 'error' | 'warning'; path: string; message: string; remediation: string; }
export interface Report { schemaVersion: '1.0.0'; status: 'PASS' | 'FAIL' | 'BLOCKED'; diagnostics: Diagnostic[]; artifactPaths: string[]; }
export const contractNames = ['game-asset-request','visual-spec','asset-definition','asset-binding','theme-pack','genre-kit','build-profile','bundle-manifest','asset-lock'] as const;
export type ContractName = typeof contractNames[number];
const ajv = new Ajv2020({ allErrors: true, strict: false });
(addFormats as unknown as (a: Ajv2020) => void)(ajv);
const validators = new Map(contractNames.map(name => [name, ajv.compile(JSON.parse(readFileSync(new URL(`../../schemas/${name}.schema.json`, import.meta.url), 'utf8')))]));
export function diagnostic(code: string, path: string, message: string, remediation = 'Correct the input and rerun validation.'): Diagnostic {
 return { code, severity: 'error', path, message, remediation };
}
export function report(diagnostics: Diagnostic[]): Report { return { schemaVersion: '1.0.0', status: diagnostics.some(d=>d.severity==='error') ? 'FAIL':'PASS', diagnostics, artifactPaths: [] }; }
export function validateContract(name: ContractName, value: unknown): Report {
 const validator = validators.get(name);
 if (!validator) return report([diagnostic('E_SCHEMA_INVALID','',`Unknown contract ${name}`)]);
 validator(value);
 return report((validator.errors ?? []).map(e=>diagnostic('E_SCHEMA_INVALID',e.instancePath,`${e.keyword}: ${e.message}`)));
}
