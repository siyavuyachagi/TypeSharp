import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { parseClassesFromFile } from './parse-classes-from-file.js';
import chalk from 'chalk';
/**
 * Parse C# files in the target project(s)
 */
export async function parseCSharpFiles(config) {
    // Hardcoded to TypeSharp only
    const targetAnnotation = 'TypeSharp';
    // Convert single project to array for unified handling
    const projectFiles = resolveProjectFilesFromSource(config.source);
    const allResults = [];
    // Process each project
    for (const projectFile of projectFiles) {
        const projectDir = path.dirname(projectFile);
        const csFiles = await glob('**/*.cs', {
            cwd: projectDir,
            absolute: true,
            ignore: ['**/bin/**', '**/obj/**', '**/node_modules/**']
        });
        for (const filePath of csFiles) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const classes = parseClassesFromFile(content, targetAnnotation);
            if (classes.length > 0) {
                // Store relative path for preserving folder structure later
                const relativePath = path.relative(projectDir, filePath);
                allResults.push({ classes, filePath, relativePath });
            }
        }
    }
    return allResults;
}
/**
 * Resolves a list of `.csproj` file paths from one or more source entries.
 *
 * Supported source types:
 * - `.csproj` — used directly
 * - `.sln`    — parsed using regex to extract referenced `.csproj` paths
 * - `.slnx`   — parsed as XML to extract `<Project Path="..." />` entries
 *
 * @param source - A single path or array of paths to `.csproj`, `.sln`, or `.slnx` files
 * @returns A flat array of resolved absolute `.csproj` file paths
 * @throws If a source file type is not `.csproj`, `.sln`, or `.slnx`
 *
 * @example
 * // Single solution file
 * resolveProjectFilesFromSource('C:/MyApp/MyApp.sln');
 *
 * @example
 * // XML solution file
 * resolveProjectFilesFromSource('C:/MyApp/MyApp.slnx');
 *
 * @example
 * // Mixed sources
 * resolveProjectFilesFromSource([
 *   'C:/MyApp/MyApp.slnx',
 *   'C:/Other/Other.csproj'
 * ]);
 */
export function resolveProjectFilesFromSource(source) {
    const sources = Array.isArray(source) ? source : [source];
    const csprojFiles = [];
    for (const s of sources) {
        if (s.endsWith('.sln')) {
            const content = fs.readFileSync(s, 'utf-8');
            const slnDir = path.dirname(s);
            const matches = [...content.matchAll(/"([^"]+\.csproj)"/g)];
            for (const match of matches) {
                const relPath = match[1].replace(/\\/g, path.sep);
                csprojFiles.push(path.resolve(slnDir, relPath));
            }
        }
        else if (s.endsWith('.slnx')) {
            const content = fs.readFileSync(s, 'utf-8');
            const slnDir = path.dirname(s);
            const matches = [...content.matchAll(/<Project\s+Path="([^"]+\.csproj)"\s*\/>/g)];
            for (const match of matches) {
                const relPath = match[1].replace(/\\/g, path.sep);
                csprojFiles.push(path.resolve(slnDir, relPath));
            }
        }
        else if (s.endsWith('.csproj')) {
            csprojFiles.push(s);
        }
        else {
            throw new Error(`Unsupported source file type: "${path.basename(s)}". Expected .csproj, .sln, or .slnx`);
        }
    }
    console.log(' csproj files [');
    csprojFiles.forEach(file => console.log(chalk.green(`  '${file}'`)));
    console.log(' ]');
    return csprojFiles;
}
//# sourceMappingURL=index.js.map