import { NamingConvention } from "./naming-convention.js";
import { NamingConventionConfig } from "./naming-convention-config.js";
import { TypeSharpConfig } from "./typesharp-config.js";
/**
 * Parsed C# property
 */
export interface CSharpProperty {
    name: string;
    type: string;
    isNullable: boolean;
    isArray: boolean;
    isGeneric: boolean;
    /** Whether the property is marked as obsolete/deprecated */
    isDeprecated: boolean;
    /** Optional message from [Obsolete("...")] */
    deprecationMessage?: string;
    genericType?: string;
    region?: string;
}
/**
 * Parsed C# class, record, or enum
 */
export interface CSharpClass {
    name: string;
    properties: CSharpProperty[];
    inheritsFrom?: string;
    isEnum: boolean;
    /** Whether the source type was a C# record (record class / record struct / positional record) */
    isRecord: boolean;
    /** Whether the enum should be generated as a const + union type instead of a TS enum */
    isUnion?: boolean;
    enumValues?: string[];
    genericParameters?: string[];
    baseClassGenerics?: string[];
}
/**
 * Result of parsing C# files
 */
export interface ParseResult {
    classes: CSharpClass[];
    filePath: string;
    relativePath: string;
}
/**
 * Generation options
 */
export interface GenerationOptions {
    config: TypeSharpConfig;
    classes: CSharpClass[];
}
export type { TypeSharpConfig };
export type { NamingConventionConfig };
export type { NamingConvention };
//# sourceMappingURL=index.d.ts.map