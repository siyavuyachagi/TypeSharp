import { extractDocSummary, removeComments } from "./parse-comments-handler.js";
import { parseEnum } from "./parse-enums.js";
import { parseProperties } from "./parse-properties.js";
import { parseRecordParameters } from "./parse-properties.js";
/**
 * Parse classes and records from a C# file content
 */
export function parseClassesFromFile(content, targetAnnotation, includeComments = false) {
    const classes = [];
    const cleanContent = removeComments(content);
    const annotationRegex = new RegExp(`\\[${targetAnnotation}(?:Attribute)?(?:\\(\\s*"([^"]*)"\\s*\\))?(?:\\s*,\\s*[^\\]]+)?\\]`, 'g');
    const matches = [...cleanContent.matchAll(annotationRegex)];
    for (const match of matches) {
        const startIndex = match.index;
        const afterAnnotation = cleanContent.substring(startIndex);
        // Check if it's an enum
        const enumMatch = afterAnnotation.match(/^(?:\[[\w]+(?:\([^)]*\))?(?:\s*,\s*[^\]]+)?\]\s*)*public\s+enum\s+(\w+)/);
        if (enumMatch) {
            const typeNameOverride = match[1] ?? undefined;
            const enumClass = parseEnum(afterAnnotation, typeNameOverride ?? enumMatch[1], includeComments);
            if (enumClass) {
                enumClass.isUnion = hasUnionAttribute(cleanContent, startIndex, afterAnnotation, match[0]);
                if (includeComments) {
                    enumClass.summary = extractDocSummary(cleanContent, startIndex);
                }
                classes.push(enumClass);
            }
            continue;
        }
        // Check if it's a record (positional or with body)
        // NOTE: we do NOT capture ctor params in the regex — attributes inside params
        // contain `()` which would break a [^)]* capture group.
        // Use paren-balanced extraction instead.
        const recordMatch = afterAnnotation.match(/^(?:\[[\w]+(?:\([^)]*\))?(?:\s*,\s*[^\]]+)?\]\s*)*public\s+(?:sealed\s+|abstract\s+)?record\s+(?:class\s+|struct\s+)?(\w+)(?:<([^>]+)>)?/);
        if (recordMatch) {
            const className = recordMatch[1];
            const genericParams = recordMatch[2];
            // Extract primary ctor params with paren-depth balancing so that
            // attributes like [property: TypeAs("Date")] don't truncate the capture
            const primaryCtorParams = extractPrimaryCtorParams(afterAnnotation);
            // After the ctor (if any), look for `: BaseType<Generics>`
            const ctorOpenIdx = afterAnnotation.indexOf('(');
            const afterCtor = (primaryCtorParams !== undefined && ctorOpenIdx !== -1)
                ? afterAnnotation.slice(ctorOpenIdx + primaryCtorParams.length + 2)
                : afterAnnotation.slice(recordMatch[0].length);
            const inheritMatch = afterCtor.match(/^\s*:\s*(\w+)(?:<([^>]+)>)?/);
            const inheritsFrom = inheritMatch?.[1];
            const baseGenerics = inheritMatch?.[2];
            const resolvedInheritsFrom = inheritsFrom && /^I[A-Z]/.test(inheritsFrom)
                ? undefined
                : inheritsFrom;
            const genericParameters = genericParams
                ? genericParams.split(',').map(p => p.trim())
                : undefined;
            const baseClassGenerics = baseGenerics
                ? baseGenerics.split(',').map(p => p.trim())
                : undefined;
            const typeNameOverride = match[1] ?? undefined;
            // Parse positional primary constructor parameters. Strip any `///`
            // doc-comment lines first — per-parameter summaries aren't supported
            // yet, and (like the enum case) their commas would otherwise corrupt
            // splitTopLevelParams. Use a separate variable so the offset math
            // above (which relies on primaryCtorParams.length) stays correct.
            const ctorParamsForParsing = primaryCtorParams
                ?.split('\n')
                .filter(line => !line.trim().startsWith('///'))
                .join('\n');
            const positionalProperties = ctorParamsForParsing
                ? parseRecordParameters(ctorParamsForParsing)
                : [];
            // Also parse any body properties (records can have both)
            const classBody = extractClassBody(afterAnnotation);
            const bodyProperties = classBody
                ? parseProperties(classBody, includeComments)
                : [];
            // Deduplicate: body props take priority if name clashes
            const bodyPropNames = new Set(bodyProperties.map(p => p.name));
            const mergedProperties = [
                ...positionalProperties.filter(p => !bodyPropNames.has(p.name)),
                ...bodyProperties,
            ];
            classes.push({
                name: typeNameOverride ?? className,
                originalName: className,
                properties: mergedProperties,
                inheritsFrom: resolvedInheritsFrom,
                isEnum: false,
                isRecord: true,
                genericParameters,
                baseClassGenerics: resolvedInheritsFrom ? baseClassGenerics : undefined,
                summary: includeComments ? extractDocSummary(cleanContent, startIndex) : undefined
            });
            continue;
        }
        // Regular class
        const classMatch = afterAnnotation.match(/^(?:\[[\w]+(?:\([^)]*\))?(?:\s*,\s*[^\]]+)?\]\s*)*public\s+class\s+(\w+)(?:<([^>]+)>)?(?:\s*:\s*(\w+)(?:<([^>]+)>)?)?/);
        if (classMatch) {
            const className = classMatch[1];
            const genericParams = classMatch[2];
            const inheritsFrom = classMatch[3];
            const baseGenerics = classMatch[4];
            const resolvedInheritsFrom = inheritsFrom && /^I[A-Z]/.test(inheritsFrom)
                ? undefined
                : inheritsFrom;
            const classBody = extractClassBody(afterAnnotation);
            if (classBody) {
                const { cleanedBody, injectedProperties } = stripNestedAnnotatedClasses(classBody, targetAnnotation);
                const properties = [
                    ...parseProperties(cleanedBody, includeComments),
                    ...injectedProperties
                ];
                const genericParameters = genericParams
                    ? genericParams.split(',').map(p => p.trim())
                    : undefined;
                const baseClassGenerics = baseGenerics
                    ? baseGenerics.split(',').map(p => p.trim())
                    : undefined;
                const typeNameOverride = match[1] ?? undefined;
                classes.push({
                    name: typeNameOverride ?? className,
                    originalName: className,
                    properties,
                    inheritsFrom: resolvedInheritsFrom,
                    isEnum: false,
                    isRecord: false,
                    genericParameters,
                    baseClassGenerics: resolvedInheritsFrom ? baseClassGenerics : undefined,
                    summary: includeComments ? extractDocSummary(cleanContent, startIndex) : undefined
                });
            }
        }
    }
    return classes;
}
/**
 * Checks if [Union] attribute is present near the [TypeSharp] annotation.
 * Looks both after [TypeSharp] (up to the enum keyword) and on lines before it.
 */
function hasUnionAttribute(cleanContent, startIndex, afterAnnotation, matchText) {
    // [TypeSharp, Union] — Union inside the same bracket
    if (/\bUnion\b/.test(matchText))
        return true;
    // [TypeSharp][Union] — Union in afterAnnotation before the enum keyword
    const enumIdx = afterAnnotation.search(/\benum\b/);
    if (enumIdx !== -1 && /\[Union\]/.test(afterAnnotation.substring(0, enumIdx))) {
        return true;
    }
    // [Union] on lines before [TypeSharp]
    const lines = cleanContent.substring(0, startIndex).split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line === '')
            continue;
        if (line.startsWith('[')) {
            if (/\[Union\]/.test(line))
                return true;
            continue;
        }
        break;
    }
    return false;
}
/**
 * Extract class body between curly braces
 */
function extractClassBody(content) {
    let braceCount = 0;
    let startIndex = -1;
    for (let i = 0; i < content.length; i++) {
        if (content[i] === '{') {
            if (braceCount === 0)
                startIndex = i;
            braceCount++;
        }
        else if (content[i] === '}') {
            braceCount--;
            if (braceCount === 0 && startIndex !== -1) {
                return content.substring(startIndex + 1, i);
            }
        }
    }
    return null;
}
/**
 * Extract the primary constructor parameter string from a record declaration,
 * using paren-depth balancing so attribute parens like `[property: TypeAs("Date")]`
 * don't cause early termination.
 *
 * Returns the raw content between the outermost `(` and its matching `)`,
 * or undefined if no primary constructor is present (body-only record).
 *
 * The search starts after the class/record name so that attribute parens on
 * the annotation itself are skipped.
 */
function extractPrimaryCtorParams(content) {
    // Find the record name first so we skip annotation parens
    const nameIdx = content.search(/\brecord\b/);
    if (nameIdx === -1)
        return undefined;
    // Scan forward from the record keyword for the first `(` that isn't preceded
    // by a `[` sequence (i.e. belongs to the ctor, not an attribute)
    let i = nameIdx;
    // Skip past the record keyword and name (and optional generics)
    // by looking for the first `(` or `{` at the top paren-depth
    let bracketDepth = 0; // tracks [] depth to ignore attr parens
    while (i < content.length) {
        const ch = content[i];
        if (ch === '[') {
            bracketDepth++;
            i++;
            continue;
        }
        if (ch === ']') {
            bracketDepth--;
            i++;
            continue;
        }
        // Only treat `(` as ctor open when we're not inside a `[...]`
        if (ch === '(' && bracketDepth === 0) {
            // Found the ctor opening paren — walk to the matching `)`
            let depth = 0;
            const start = i;
            for (let j = i; j < content.length; j++) {
                if (content[j] === '(')
                    depth++;
                else if (content[j] === ')') {
                    depth--;
                    if (depth === 0) {
                        return content.slice(start + 1, j);
                    }
                }
            }
            return undefined; // unmatched paren
        }
        // A `{` at bracket-depth 0 means we hit the body before a ctor — body-only record
        if (ch === '{' && bracketDepth === 0)
            return undefined;
        i++;
    }
    return undefined;
}
/**
 * Strip nested annotated classes from a class body and inject reference properties.
 */
function stripNestedAnnotatedClasses(classBody, targetAnnotation) {
    const injectedProperties = [];
    const regionsToRemove = [];
    const annotationRegex = new RegExp(`\\[${targetAnnotation}(?:Attribute)?(?:\\(\\s*"([^"]*)"\\s*\\))?\\]\\s*public\\s+class\\s+(\\w+)`, 'g');
    const matches = [...classBody.matchAll(annotationRegex)];
    for (const match of matches) {
        const typeNameOverride = match[1] ?? undefined;
        const nestedClassName = match[2];
        const resolvedName = typeNameOverride ?? nestedClassName;
        const fromIndex = match.index;
        const afterMatch = classBody.substring(fromIndex);
        const braceStart = afterMatch.indexOf('{');
        if (braceStart === -1)
            continue;
        let depth = 0;
        let end = -1;
        for (let i = braceStart; i < afterMatch.length; i++) {
            if (afterMatch[i] === '{')
                depth++;
            else if (afterMatch[i] === '}') {
                depth--;
                if (depth === 0) {
                    end = i;
                    break;
                }
            }
        }
        if (end === -1)
            continue;
        regionsToRemove.push({
            start: fromIndex,
            end: fromIndex + braceStart + end + 1
        });
        const propName = nestedClassName.charAt(0).toLowerCase() + nestedClassName.slice(1);
        injectedProperties.push({
            name: propName,
            type: resolvedName,
            isNullable: false,
            isArray: false,
            isGeneric: false,
            isDeprecated: false,
        });
    }
    let cleanedBody = classBody;
    for (const region of regionsToRemove.reverse()) {
        cleanedBody = cleanedBody.substring(0, region.start) + cleanedBody.substring(region.end);
    }
    return { cleanedBody, injectedProperties };
}
//# sourceMappingURL=parse-classes-from-file.js.map