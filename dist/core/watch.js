import * as path from 'path';
import { generate, loadConfig } from './index.js';
import { watchDirectory } from '../helpers/watcher.js';
import { logger } from '../helpers/logger.js';
const DEBOUNCE_MS = 300;
const IGNORED_SEGMENTS = [
    'node_modules',
    '.git',
    '.typesharp',
    'dist',
    'build',
    '.nuxt',
    '.output',
    '.next',
    '.svelte-kit'
];
/**
 * Start TypeSharp in watch mode.
 * Runs an initial generation (respecting the incremental flag),
 * then watches the entire project for any file change and re-runs
 * incremental generation on each detected save.
 *
 * Note: fs.watch recursive mode requires Node >= 20 on Windows/macOS.
 * Linux support requires Node >= 22.
 */
export async function startWatch(configPath, incremental) {
    logger.info('startWatch', 'TypeSharp - Starting watch mode...');
    // Initial generation — full or incremental depending on the flag
    await generate(configPath, incremental);
    // Load config so we can exclude the output directory from watch events
    const config = await loadConfig(configPath);
    const outputPath = path.resolve(config.outputPath);
    const watchDir = process.cwd();
    logger.info('startWatch', 'Watching for changes...');
    logger.info('startWatch', `Directory : ${watchDir}`);
    logger.info('startWatch', `Debounce  : ${DEBOUNCE_MS}ms`);
    logger.info('startWatch', 'Press Ctrl+C to stop\n');
    let debounceTimer = null;
    let isGenerating = false;
    const watcher = watchDirectory(watchDir, (_eventType, filename) => {
        if (!filename)
            return;
        const absoluteFile = path.resolve(watchDir, filename);
        // Ignore changes inside the output directory — prevents infinite loop
        if (absoluteFile.startsWith(outputPath + path.sep) || absoluteFile === outputPath)
            return;
        const normalized = filename.replace(/\\/g, '/');
        const segments = normalized.split('/');
        // Ignore common non-source directories
        if (segments.some(seg => IGNORED_SEGMENTS.includes(seg)))
            return;
        // Debounce — batch rapid saves (e.g. formatter running on save)
        if (debounceTimer)
            clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            if (isGenerating)
                return;
            isGenerating = true;
            logger.info('startWatch', `Change detected: ${filename}`);
            try {
                // Always incremental after the initial run —
                // hashing determines which C# files actually changed
                await generate(configPath, true);
            }
            catch {
                // generate() already logs the error — don't kill the watcher
            }
            finally {
                isGenerating = false;
            }
        }, DEBOUNCE_MS);
    });
    // Graceful shutdown on Ctrl+C
    process.on('SIGINT', () => {
        logger.info('startWatch', 'TypeSharp watch stopped.');
        watcher.close();
        process.exit(0);
    });
    // Keep the process alive indefinitely
    await new Promise(() => { });
}
//# sourceMappingURL=watch.js.map