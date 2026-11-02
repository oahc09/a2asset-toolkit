export {validateContract,contractNames,type Report,type Diagnostic} from './contracts/validate.js';
export {mapGameSpec,type SourceValidator} from './bridge/game-spec.js';
export {AssetRegistry,type ReviewRecord,type RegistryEntry} from './registry/index.js';
export {inspectFile,inspectDirectory,inspectArchive,type InspectOptions} from './importer/index.js';
export {importAssets} from './core/import-assets.js';
export {resolveAssets,type ResolveInput,type ResolveResult} from './resolver/index.js';
export {processAsset,type ProcessorOptions} from './processors/index.js';
export {processMediaAsset,mediaToolchainFor} from './processors/media.js';
export {buildBundle,validatePackage,type BuildInput,type BuildResult} from './builder/index.js';
export {evaluateQuality,summarizeCoverage,type QualityInput,type QualityReport,type EvidenceTrust} from './quality/index.js';
export {importBatch,MAX_BATCH_IMPORT_JOBS,type BatchImportInput,type BatchImportJob,type BatchImportReport} from './core/import-batch.js';

export {recoverPublication,type RecoverPublicationInput,type RecoveryResult} from './builder/recovery.js';
