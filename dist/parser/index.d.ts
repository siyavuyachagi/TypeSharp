import { ParseResult } from '../types/index.js';
import { TypeSharpConfig } from '../types/typesharp-config.js';
/**
 * Parse C# files in the target project(s)
 */
export declare function parseCSharpFiles(config: TypeSharpConfig): Promise<ParseResult[]>;
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
export declare function resolveProjectFilesFromSource(source: string | string[]): string[];
//# sourceMappingURL=index.d.ts.map