/**
 * Parse properties from class body
 */
export function parseProperties(classBody) {
    const properties = [];
    // Build a region map: characterIndex -> regionName
    const regionMap = buildRegionMap(classBody);
    const getRegion = (index) => {
        let active;
        for (const [start, name] of regionMap) {
            if (start <= index)
                active = name;
            else
                break;
        }
        return active;
    };
    let match;
    // Match property declarations with get/set/init accessors
    const propertyRegex = /public\s+([\w<>[\]?]+)\s+(\w+)\s*\{\s*(?:get;\s*)?(?:set|init);\s*\}/g;
    while ((match = propertyRegex.exec(classBody)) !== null) {
        const type = match[1];
        const name = match[2];
        const tsAttrs = extractTypeSharpAttributeInfo(classBody, match.index);
        if (tsAttrs.ignore)
            continue;
        const resolvedName = tsAttrs.overrideName ?? name;
        const resolvedType = tsAttrs.overrideType ?? type;
        const obs = extractObsoleteInfo(classBody, match.index);
        properties.push({ ...parsePropertyType(resolvedName, resolvedType), ...obs, region: getRegion(match.index) });
    }
    // Also match computed/expression-bodied properties (with =>)
    const computedPropertyRegex = /public\s+([\w<>[\]?]+)\s+(\w+)\s*=>/g;
    while ((match = computedPropertyRegex.exec(classBody)) !== null) {
        const type = match[1];
        const name = match[2];
        const tsAttrs = extractTypeSharpAttributeInfo(classBody, match.index);
        if (tsAttrs.ignore)
            continue;
        const resolvedName = tsAttrs.overrideName ?? name;
        const resolvedType = tsAttrs.overrideType ?? type;
        const obs = extractObsoleteInfo(classBody, match.index);
        properties.push({ ...parsePropertyType(resolvedName, resolvedType), ...obs, region: getRegion(match.index) });
    }
    // { get { return ...; } }
    const getBlockRegex = /public\s+([\w<>[\]?]+)\s+(\w+)\s*\{\s*get\s*\{[^}]*\}\s*\}/g;
    while ((match = getBlockRegex.exec(classBody)) !== null) {
        const type = match[1];
        const name = match[2];
        const tsAttrs = extractTypeSharpAttributeInfo(classBody, match.index);
        if (tsAttrs.ignore)
            continue;
        const resolvedName = tsAttrs.overrideName ?? name;
        const resolvedType = tsAttrs.overrideType ?? type;
        const obs = extractObsoleteInfo(classBody, match.index);
        properties.push({ ...parsePropertyType(resolvedName, resolvedType), ...obs, region: getRegion(match.index) });
    }
    return properties;
}
/**
 * Build a sorted map of character index -> region name from #region / #endregion blocks.
 * Index points to where that region becomes active (or undefined after #endregion).
 */
function buildRegionMap(classBody) {
    const map = new Map();
    const regionRegex = /#region\s+(.+)|#endregion/g;
    let match;
    while ((match = regionRegex.exec(classBody)) !== null) {
        if (match[0].startsWith('#region')) {
            map.set(match.index, match[1].trim());
        }
        else {
            map.set(match.index, undefined);
        }
    }
    return new Map([...map.entries()].sort((a, b) => a[0] - b[0]));
}
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
export function parseRecordParameters(raw) {
    const properties = [];
    // Split on top-level commas (skip commas inside angle brackets or square brackets)
    const params = splitTopLevelParams(raw);
    for (const param of params) {
        const trimmed = param.trim();
        if (!trimmed)
            continue;
        // Extract all [Attr] tokens from the front of the param string,
        // then treat the remainder as "type name".
        // This handles both inline attrs ([TypeAs("x")] DateTime CreatedAt)
        // and multiline attrs (separate lines with \n between them).
        const { attrTokens, remainder } = extractLeadingAttributes(trimmed);
        const typeAndName = remainder.trim();
        if (!typeAndName)
            continue;
        // Check [TypeIgnore] — supports [property: TypeIgnore]
        const ignore = attrTokens.some(l => /\[\s*(?:property\s*:\s*)?TypeIgnore\]/.test(l));
        if (ignore)
            continue;
        // Check [TypeName("x")] — supports [property: TypeName("x")]
        let overrideName;
        for (const l of attrTokens) {
            const m = l.match(/\[\s*(?:property\s*:\s*)?TypeName\s*\(\s*"([^"]+)"\s*\)\]/);
            if (m) {
                overrideName = m[1];
                break;
            }
        }
        // Check [TypeAs("y")] — supports [property: TypeAs("y")]
        let overrideType;
        for (const l of attrTokens) {
            const m = l.match(/\[\s*(?:property\s*:\s*)?TypeAs\s*\(\s*"([^"]+)"\s*\)\]/);
            if (m) {
                overrideType = m[1];
                break;
            }
        }
        // Check [Obsolete] / [Obsolete("message")] — supports [property: Obsolete("msg")]
        let isDeprecated = false;
        let deprecationMessage;
        for (const l of attrTokens) {
            const m = l.match(/\[\s*(?:property\s*:\s*)?Obsolete(?:Attribute)?\s*(?:\(\s*"([^"]*)"\s*(?:,\s*(?:true|false))?\s*\))?\]/i);
            if (m) {
                isDeprecated = true;
                deprecationMessage = m[1] ?? undefined;
                break;
            }
        }
        // Parse "TypeToken NameToken" — handle nested generics via angle-bracket depth
        const parsed = parseTypeAndName(typeAndName);
        if (!parsed)
            continue;
        const { csType, name } = parsed;
        const resolvedType = overrideType ?? csType;
        const resolvedName = overrideName ?? name;
        const prop = parsePropertyType(resolvedName, resolvedType);
        properties.push({ ...prop, isDeprecated, deprecationMessage });
    }
    return properties;
}
/**
 * Walk a parameter string and peel off every leading [Attr] / [Attr("...")] token,
 * returning them as an array plus the remaining "type name" tail.
 *
 * Works for both inline attrs  → "[TypeAs("Date")] DateTime CreatedAt"
 * and multiline attrs          → "[Obsolete]\n  string OldId"
 */
function extractLeadingAttributes(s) {
    const attrTokens = [];
    let i = 0;
    // Skip leading whitespace / newlines
    while (i < s.length && /\s/.test(s[i]))
        i++;
    while (i < s.length && s[i] === '[') {
        // Find the matching ']', respecting nested brackets (e.g. [Obsolete("msg")])
        let depth = 0;
        let end = i;
        for (let j = i; j < s.length; j++) {
            if (s[j] === '[')
                depth++;
            else if (s[j] === ']') {
                depth--;
                if (depth === 0) {
                    end = j;
                    break;
                }
            }
        }
        attrTokens.push(s.slice(i, end + 1).trim());
        i = end + 1;
        // Skip whitespace/newlines between attributes or before the type token
        while (i < s.length && /\s/.test(s[i]))
            i++;
    }
    return { attrTokens, remainder: s.slice(i) };
}
/**
 * Split a raw parameter string on top-level commas
 * (i.e. commas not inside <> or [])
 */
function splitTopLevelParams(raw) {
    const parts = [];
    let depth = 0;
    let buf = '';
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === '<' || ch === '[') {
            depth++;
            buf += ch;
        }
        else if (ch === '>' || ch === ']') {
            depth--;
            buf += ch;
        }
        else if (ch === ',' && depth === 0) {
            parts.push(buf);
            buf = '';
        }
        else {
            buf += ch;
        }
    }
    if (buf.trim())
        parts.push(buf);
    return parts;
}
/**
 * Parse a "TypeToken NameToken" string where TypeToken may contain generics.
 * Returns null if the string doesn't look like a valid type+name pair.
 */
function parseTypeAndName(s) {
    s = s.trim();
    // Walk the string tracking angle-bracket depth to find the boundary
    // between the type token and the name token
    let depth = 0;
    let splitAt = -1;
    // Find the last space at depth 0 — that separates type from name
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '<')
            depth++;
        else if (s[i] === '>')
            depth--;
        else if (s[i] === ' ' && depth === 0) {
            splitAt = i;
        }
    }
    if (splitAt === -1)
        return null;
    const csType = s.slice(0, splitAt).trim();
    const name = s.slice(splitAt + 1).trim();
    if (!csType || !name)
        return null;
    return { csType, name };
}
function extractObsoleteInfo(classBody, matchIndex) {
    const before = classBody.substring(0, matchIndex);
    const lines = before.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line === '')
            continue;
        if (line.startsWith('[')) {
            const obsoleteMatch = line.match(/\[Obsolete(?:Attribute)?\s*(?:\(\s*"([^"]*)"\s*(?:,\s*(?:true|false))?\s*\))?\]/i);
            if (obsoleteMatch) {
                return {
                    isDeprecated: true,
                    deprecationMessage: obsoleteMatch[1] ?? undefined
                };
            }
            continue;
        }
        break;
    }
    return { isDeprecated: false };
}
function extractTypeSharpAttributeInfo(classBody, matchIndex) {
    const before = classBody.substring(0, matchIndex);
    const lines = before.split('\n');
    let ignore = false;
    let overrideName;
    let overrideType;
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line === '')
            continue;
        if (!line.startsWith('['))
            break;
        if (/\[TypeIgnore\]/.test(line))
            ignore = true;
        const nameMatch = line.match(/\[TypeName\s*\(\s*"([^"]+)"\s*\)\]/);
        if (nameMatch)
            overrideName = nameMatch[1];
        const asMatch = line.match(/\[TypeAs\s*\(\s*"([^"]+)"\s*\)\]/);
        if (asMatch)
            overrideType = asMatch[1];
    }
    return { ignore, overrideName, overrideType };
}
function parsePropertyType(name, csType) {
    let raw = csType.trim();
    let isNullable = false;
    if (raw.endsWith('?')) {
        isNullable = true;
        raw = raw.slice(0, -1).trim();
    }
    function resolveType(typeText) {
        const t = typeText.trim();
        if (t.endsWith('[]')) {
            const inner = t.slice(0, -2).trim();
            const resolved = resolveType(inner);
            return { tsType: resolved.tsType, isArray: true };
        }
        if (/^(?:[\w.]+\.)?(?:Dictionary|IDictionary|IReadOnlyDictionary)\s*</.test(t)) {
            const firstAngle = t.indexOf('<');
            const lastAngle = findMatchingAngleBracket(t, firstAngle);
            if (firstAngle !== -1 && lastAngle !== -1) {
                const inner = t.slice(firstAngle + 1, lastAngle).trim();
                const args = splitTopLevelGenericArgs(inner);
                if (args.length === 2) {
                    const keyCs = args[0];
                    const valueCs = args[1];
                    if (typeof keyCs !== 'string' || typeof valueCs !== 'string' || keyCs.trim() === '' || valueCs.trim() === '') {
                        return { tsType: 'Record<string, any>', isArray: false };
                    }
                    const resolvedKey = resolveType(keyCs);
                    const resolvedValue = resolveType(valueCs);
                    const keyTsRaw = resolvedKey.tsType;
                    const safeKey = keyTsRaw === 'string' || keyTsRaw === 'number' || keyTsRaw === 'symbol'
                        ? keyTsRaw
                        : 'string';
                    const valueType = resolvedValue.isArray ? `${resolvedValue.tsType}[]` : resolvedValue.tsType;
                    return { tsType: `Record<${safeKey}, ${valueType}>`, isArray: false };
                }
            }
        }
        const collectionMatch = t.match(/^(?:List|IEnumerable|ICollection|IList)\s*<\s*(.+)\s*>$/);
        if (collectionMatch) {
            const inner = collectionMatch[1].trim();
            const resolvedInner = resolveType(inner);
            return { tsType: resolvedInner.tsType, isArray: true };
        }
        return { tsType: mapCSharpTypeToTypeScript(t), isArray: false };
    }
    const resolved = resolveType(raw);
    return {
        name,
        type: resolved.tsType,
        isNullable,
        isArray: resolved.isArray,
        isGeneric: false,
        genericType: undefined,
        isDeprecated: false,
        deprecationMessage: undefined,
    };
}
function findMatchingAngleBracket(s, startIdx) {
    let depth = 0;
    for (let i = startIdx; i < s.length; i++) {
        if (s[i] === '<')
            depth++;
        else if (s[i] === '>') {
            depth--;
            if (depth === 0)
                return i;
        }
    }
    return -1;
}
function splitTopLevelGenericArgs(s) {
    const parts = [];
    let depth = 0;
    let buf = '';
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '<') {
            depth++;
            buf += ch;
        }
        else if (ch === '>') {
            depth--;
            buf += ch;
        }
        else if (ch === ',' && depth === 0) {
            parts.push(buf.trim());
            buf = '';
        }
        else {
            buf += ch;
        }
    }
    if (buf.trim().length > 0)
        parts.push(buf.trim());
    return parts;
}
function mapCSharpTypeToTypeScript(csType) {
    const typeMap = {
        'bool': 'boolean',
        'byte': 'number',
        'byte[]': 'Blob',
        'decimal': 'number',
        'double': 'number',
        'DateOnly': 'string',
        'DateTime': 'string',
        'float': 'number',
        'FileStream': 'Blob',
        'FormFile': 'File',
        'Guid': 'string',
        'int': 'number',
        'IFormFile': 'File',
        'IFormFileCollection': 'File[]',
        'long': 'number',
        'MemoryStream': 'Blob',
        'object': 'any',
        'string': 'string',
        'Stream': 'Blob',
        'TimeOnly': 'string',
        'TimeSpan': 'number',
    };
    return typeMap[csType] || csType;
}
//# sourceMappingURL=parse-properties.js.map