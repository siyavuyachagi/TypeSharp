import * as fs from 'fs';
import * as path from 'path';
import { parseCSharpFiles } from '../parser/index.js';
import { convertFileName, generateTypeScriptFiles } from '../generator/index.js';
import { pathToFileURL } from 'url';
import { logger } from '../helpers/logger.js';
/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
    singleOutputFile: false,
    namingConvention: 'kebab',
    fileSuffix: '',
    includeComments: false
};
/**
 * Load configuration from a file
 */
async function loadConfigFromFile(filePath) {
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
        }
        catch (error) {
            throw new Error(`Failed to load TypeScript config file: ${filePath}\n` +
                `In ESM mode, you have two options:\n` +
                `1. Use a .json config file instead\n` +
                `2. Use a .js config file (compile your TypeScript first)\n` +
                `3. Run TypeSharp with: node --loader tsx/cjs ./bin/typesharp.js\n` +
                `Original error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    throw new Error(`Unsupported config file format: ${ext}`);
}
/**
 * Merge user config with defaults
 */
export const mergeWithDefaults = (config) => {
    if (!config.source) {
        throw new Error('`source` is required in configuration');
    }
    if (!config.outputPath) {
        throw new Error('outputPath is required in configuration');
    }
    return {
        ...DEFAULT_CONFIG,
        ...config,
    };
};
/**
 * Compute the expected generated .ts output path for a given C# source file,
 * based on its resolved project source, naming convention, and suffix.
 * Returns undefined if no matching source project can be resolved.
 */
export function getExpectedTsFilePath(config, csharpFilePath) {
    const outputPath = config.outputPath;
    const sources = Array.isArray(config.source) ? config.source : [config.source];
    const normalize = (p) => path.resolve(p).replace(/\\/g, '/');
    const normalizedCsharpPath = normalize(csharpFilePath);
    const matchingSource = sources.find(s => normalizedCsharpPath.startsWith(normalize(path.dirname(s))));
    if (!matchingSource)
        return undefined;
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
    return path.join(outputPath, path.dirname(relativePath), tsFileName);
}
export async function generate(configPath, incremental = true) {
    try {
        console.log('\n');
        logger.info('generate', 'TypeSharp - Starting generation...');
        const config = await loadConfig(configPath);
        logger.success('generate', 'Configuration loaded');
        logger.info('generate', 'Parsing C# files...');
        const parseResults = await parseCSharpFiles(config);
        // Run cleanup even when zero files currently match [TypeSharp] — otherwise
        // deleting the last remaining tracked source leaves its stale generated
        // .ts file behind forever, since the old early return skipped this step.
        let changedFiles;
        if (incremental) {
            changedFiles = await cleanOnlyChangedOutputFiles(config, parseResults);
        }
        else {
            cleanOutputDirectory(config.outputPath);
        }
        if (parseResults.length === 0) {
            console.log('\n');
            logger.warn('generate', 'No C# files found with [TypeSharp] attribute');
            return;
        }
        const allClasses = parseResults.flatMap(result => result.classes);
        logger.success('generate', `Found ${allClasses.length} ${allClasses.length === 1 ? 'class' : 'classes'} with [TypeSharp] attribute`);
        const metrics = incremental
            ? generateTypeScriptFiles(config, parseResults, changedFiles)
            : generateTypeScriptFiles(config, parseResults);
        logger.info('generate', `Created: ${metrics.created} | Updated: ${metrics.updated} | Total: ${metrics.total}`);
        logger.success('generate', 'Generation completed successfully!');
        logger.divider();
    }
    catch (error) {
        logger.error('generate', error instanceof Error ? error.message : 'An unknown error occurred');
        console.log('');
        throw error;
    }
}
/**
 * Clean only output files corresponding to changed C# files
 */
async function cleanOnlyChangedOutputFiles(config, parseResults) {
    const { loadPreviousHashes, savePreviousHashes, getChangedFiles, computeFileHash } = await import('../helpers/change-tracker.js');
    const csharpFiles = parseResults.map(r => r.filePath);
    const previousHashes = loadPreviousHashes();
    const { changed, deleted } = getChangedFiles(csharpFiles, previousHashes);
    if (deleted.length > 0) {
        for (const deletedFile of deleted) {
            removeCorrespondingTsFile(config, deletedFile);
        }
    }
    // Hash-unchanged doesn't mean output-present — someone may have deleted or
    // moved the generated file directly. Catch that here so it gets regenerated
    // instead of the tracker silently rewriting itself with matching hashes.
    const changedSet = new Set(changed);
    if (!config.singleOutputFile) {
        for (const file of csharpFiles) {
            if (changedSet.has(file))
                continue;
            const expectedTsPath = getExpectedTsFilePath(config, file);
            if (expectedTsPath && !fs.existsSync(expectedTsPath)) {
                changedSet.add(file);
            }
        }
    }
    const currentHashes = new Map();
    for (const file of csharpFiles) {
        currentHashes.set(file, computeFileHash(file));
    }
    savePreviousHashes(currentHashes);
    return changedSet;
}
/**
 * Deletes all contents of a directory but keeps the directory itself.
 * @param dir Path to the directory to clean
 */
export function cleanOutputDirectory(dir) {
    if (!fs.existsSync(dir))
        return;
    const entries = fs.readdirSync(dir);
    logger.tree(entries.map(e => path.join(dir, e)), 'cleanOutputDirectory', 'info', `Clearing output directory: ${dir}`);
    for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.lstatSync(fullPath);
        if (stat.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
        }
        else {
            fs.unlinkSync(fullPath);
        }
    }
}
/**
 * Remove TypeScript output file(s) for a deleted C# source file
 */
function removeCorrespondingTsFile(config, csharpFilePath) {
    const tsFilePath = getExpectedTsFilePath(config, csharpFilePath);
    if (!tsFilePath) {
        logger.warn('removeCorrespondingTsFile', `Could not resolve source project for deleted file: ${logger.shortPath(csharpFilePath)}`);
        return;
    }
    if (fs.existsSync(tsFilePath)) {
        fs.unlinkSync(tsFilePath);
    }
}
/**
 * Load configuration from file or use provided config
 */
export async function loadConfig(configPath) {
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
    throw new Error('No configuration file found. Please create typesharp.config.ts, typesharp.config.js, or typesharp.config.json');
}
//# sourceMappingURL=index.js.map