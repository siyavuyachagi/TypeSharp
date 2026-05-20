import { NamingConvention } from "./naming-convention.js";
import { NamingConventionConfig } from "./naming-convention-config.js";
/**
 * TypeSharp configuration file
 * @see https://github.com/siyavuyachagi/typesharp
 */
export interface TypeSharpConfig {
    /**
     * Path(s) to C# source(s): `.csproj` file(s) or a `.sln` solution file.
     * When a `.sln` is provided, TypeSharp automatically discovers all projects within it.
     *
     * Replaces the deprecated `projectFiles` option.
     * @example
     *   source: "C:/MyApp/MyApp.sln"
     *   // or
     *   source: ["C:/MyApp/Api/Api.csproj", "C:/MyApp/Domain/Domain.csproj"]
     */
    source: string | string[];
    /**
     * Path where TypeScript files will be generated
     */
    outputPath: string;
    /**
     * Controls whether generated types are written to one file or multiple files. (default: `false`)
     *
     * - true  → All generated types go into a single file: "index.ts"
     * - false → Each file is written separately, using the naming convention.
     *           The original folder structure is preserved in the output.
     */
    singleOutputFile?: boolean;
    /**
     * Naming convention for property names in generated types (default: `camel`)
     * @example
     *   "namingConvention": "camel",
     * // or
     *   "namingConvention": {
     *      dir: 'kebab',
     *      file: 'camel',
     *    }
     */
    namingConvention?: NamingConvention | NamingConventionConfig;
    /**
     * Suffix appended to generated TypeScript type names.
     * The suffix is formatted based on the selected naming convention.
     * ```
     * Examples (suffix = "dto"):
     *   camel : User -> userDto
     *   pascal: User -> UserDto
     *   snake : User -> user_dto
     *   kebab : User -> user-dto
     * ```
     */
    fileSuffix?: string;
}
//# sourceMappingURL=typesharp-config.d.ts.map