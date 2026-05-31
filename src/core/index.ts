import * as fs from 'fs';
import * as path from 'path';
import { parseCSharpFiles } from '../parser/index.js';
import { convertFileName, generateTypeScriptFiles } from '../generator/index.js';
import { TypeSharpConfig } from '../types/typesharp-config.js';
import { pathToFileURL } from 'url';
import { ParseResult } from '../types/index.js';
import { logger } from '../helpers/logger.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<TypeSharpConfig> = {
  singleOutputFile: false,
  namingConvention: 'kebab',
};

/**
 * Load configuration from a file
 */
async function loadConfigFromFile(filePath: string): Promise<TypeSharpConfig> {
  const ext = path.extname(filePath);

  if (ext === '.json') {
    const content = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(content);
    return mergeWithDefaults(config);
  }

  if (ext === '.js') {
    const fileUrl = pathToFileURL(path.resolve(filePath)).href;
    const module = await import(fileUrl);
    const exportedConfig = module.default || module;
    return mergeWithDefaults(exportedConfig);
  }

  if (ext === '.ts') {
    // In ESM mode, .ts config files need special handling
    // Try to import directly (works if tsx is registered as a loader)
    try {
      const fileUrl = pathToFileURL(path.resolve(filePath)).href;
      const module = await import(fileUrl);
      const exportedConfig = module.default || module;
      return mergeWithDefaults(exportedConfig);
    } catch (error) {
      throw new Error(
        `Failed to load TypeScript config file: ${filePath}\n` +
        `In ESM mode, you have two options:\n` +
        `1. Use a .json config file instead\n` +
        `2. Use a .js config file (compile your TypeScript first)\n` +
        `3. Run TypeSharp with: node --loader tsx/cjs ./bin/typesharp.js\n` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  throw new Error(`Unsupported config file format: ${ext}`);
}

/**
 * Merge user config with defaults
 */
export const mergeWithDefaults = (config: Partial<TypeSharpConfig>): TypeSharpConfig => {
  if (!config.source) {
    throw new Error('`source` is required in configuration');
  }

  if (!config.outputPath) {
    throw new Error('outputPath is required in configuration');
  }

  return {
    ...DEFAULT_CONFIG,
    ...config,
  } as TypeSharpConfig;
};





export async function generate(configPath?: string, incremental: boolean = true): Promise<void> {
  try {
    console.log('\n');
    logger.info('generate', 'TypeSharp - Starting generation...');

    const config = await loadConfig(configPath);
    logger.success('generate', 'Configuration loaded');

    logger.info('generate', 'Parsing C# files...');
    const parseResults = await parseCSharpFiles(config);

    if (parseResults.length === 0) {
      console.log('\n');
      logger.warn('generate', 'No C# files found with [TypeSharp] attribute');
      return;
    }

    const allClasses = parseResults.flatMap(result => result.classes);
    logger.success('generate', `Found ${allClasses.length} ${allClasses.length === 1 ? 'class' : 'classes'} with [TypeSharp] attribute`);

    let metrics;
    if (incremental) {
      const changedFiles = await cleanOnlyChangedOutputFiles(config, parseResults)
      metrics = generateTypeScriptFiles(config, parseResults, changedFiles)
    } else {
      cleanOutputDirectory(config.outputPath)
      metrics = generateTypeScriptFiles(config, parseResults)
    }

    logger.info('generate', `Created: ${metrics.created} | Updated: ${metrics.updated} | Total: ${metrics.total}`);
    logger.success('generate', 'Generation completed successfully!\n');
  } catch (error) {
    logger.error('generate', error instanceof Error ? error.message : 'An unknown error occurred');
    console.log('')
    throw error;
  }
}







/**
 * Clean only output files corresponding to changed C# files
 */
async function cleanOnlyChangedOutputFiles(
  config: TypeSharpConfig,
  parseResults: ParseResult[]
): Promise<Set<string>> {
  const { loadPreviousHashes, savePreviousHashes, getChangedFiles, computeFileHash } =
    await import('../helpers/change-tracker.js');

  const csharpFiles = parseResults.map(r => r.filePath);
  const previousHashes = loadPreviousHashes();
  const { changed, deleted } = getChangedFiles(csharpFiles, previousHashes);

  if (deleted.length > 0) {
    for (const deletedFile of deleted) {
      removeCorrespondingTsFile(config, deletedFile);
    }
  }

  const currentHashes = new Map<string, string>();
  for (const file of csharpFiles) {
    currentHashes.set(file, computeFileHash(file));
  }
  savePreviousHashes(currentHashes);

  return new Set(changed);
}



/**
 * Deletes all contents of a directory but keeps the directory itself.
 * @param dir Path to the directory to clean
 */
export function cleanOutputDirectory(dir: string) {
  if (!fs.existsSync(dir)) return

  const entries = fs.readdirSync(dir)

  logger.tree(`Clearing output directory: ${dir}`, entries.map(e => path.join(dir, e)));

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.lstatSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }
  }
}


/**
 * Remove TypeScript output file(s) for a deleted C# source file
 */
function removeCorrespondingTsFile(config: TypeSharpConfig, csharpFilePath: string): void {
  const outputPath = config.outputPath;
  const sources = Array.isArray(config.source) ? config.source : [config.source];
  const matchingSource = sources.find(s => csharpFilePath.startsWith(path.dirname(s)));
  if (!matchingSource) {
    logger.warn('removeCorrespondingTsFile', `Could not resolve source project for deleted file: ${logger.shortPath(csharpFilePath)}`)
    return;
  }
  const relativePath = path.relative(path.dirname(matchingSource), csharpFilePath);
  const fileName = path.basename(relativePath, '.cs');

  const fileConvention = typeof config.namingConvention === 'string'
    ? config.namingConvention
    : config.namingConvention?.file ?? 'camel';

  let baseName = fileName;
  if (config.fileSuffix) {
    baseName = `${baseName}${config.fileSuffix}`;
  }

  const tsFileName = convertFileName(baseName, fileConvention) + '.ts';
  const tsFilePath = path.join(outputPath, path.dirname(relativePath), tsFileName);

  if (fs.existsSync(tsFilePath)) {
    fs.unlinkSync(tsFilePath);
  }
}






/**
 * Load configuration from file or use provided config
 */
export async function loadConfig(configPath?: string): Promise<TypeSharpConfig> {
  if (configPath && fs.existsSync(configPath)) {
    return await loadConfigFromFile(configPath);
  }

  // Look for default config files
  const defaultPaths = [
    'typesharp.config.ts',
    'typesharp.config.js',
    'typesharp.config.json'
  ];

  for (const defaultPath of defaultPaths) {
    if (fs.existsSync(defaultPath)) {
      return await loadConfigFromFile(defaultPath);
    }
  }

  throw new Error(
    'No configuration file found. Please create typesharp.config.ts, typesharp.config.js, or typesharp.config.json'
  );
}
