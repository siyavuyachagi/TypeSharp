import { CSharpProperty } from "../types/index.js";
/**
 * Parse properties from class body
 */
export declare function parseProperties(classBody: string, includeComments: boolean): CSharpProperty[];
/**
 * Parse positional primary constructor parameters from a C# record declaration.
 *
 * Handles:
 *   - Simple types:            int Id
 *   - Nullable types:          string? Name
 *   - Generic types:           List<string> Tags
 *   - Nested generics:         Dictionary<string, List<int>> Map
 *   - Per-parameter attributes with the `property:` target (required by C# for ctor params):
 *       [property: TypeIgnore]
 *       [property: TypeName("x")]
 *       [property: TypeAs("y")]
 *       [property: Obsolete("msg")]
 *   - [Obsolete] / [Obsolete("msg")]
 *
 * Note: [TypeAs], [TypeName], [TypeIgnore] on record primary constructor parameters
 * MUST use the `property:` attribute target in C#:
 *   public record Foo([property: TypeAs("Date")] DateTime CreatedAt);
 *
 * @param raw - The raw text between the record's primary constructor parentheses
 */
export declare function parseRecordParameters(raw: string): CSharpProperty[];
//# sourceMappingURL=parse-properties.d.ts.map