import { CSharpClass } from "../types/index.js";

/**
 * Parse enum from C# content
 */
export function parseEnum(content: string, enumName: string): CSharpClass | null {
    const enumBodyMatch = content.match(/enum\s+\w+\s*\{([^}]+)\}/);
    if (!enumBodyMatch) return null;

    const enumValues: string[] = [];
    const enumValueSummaries: Record<string, string> = {};
    let pendingSummaryLines: string[] = [];

    for (const rawLine of enumBodyMatch[1]!.split('\n')) {
        const line = rawLine.trim();
        if (line === '') continue;

        if (line.startsWith('///')) {
            pendingSummaryLines.push(line.replace(/^\/\/\/\s?/, ''));
            continue;
        }

        // Normally one member per line, but split defensively in case
        // multiple members share a line (no comments to corrupt here —
        // /// lines were already consumed above, // lines stripped upstream).
        for (const rawMember of line.split(',')) {
            const name = rawMember.split('=')[0]!.trim();
            if (!name) continue;

            enumValues.push(name);

            if (pendingSummaryLines.length > 0) {
                const joined = pendingSummaryLines.join('\n');
                const summaryMatch = joined.match(/<summary>([\s\S]*?)<\/summary>/);
                const summaryText = (summaryMatch ? summaryMatch[1]! : joined)
                    .split('\n')
                    .map(l => l.trim())
                    .filter(Boolean)
                    .join(' ')
                    .trim();
                if (summaryText) enumValueSummaries[name] = summaryText;
                pendingSummaryLines = [];
            }
        }
    }

    return {
        name: enumName,
        properties: [],
        isEnum: true,
        isRecord: false,
        enumValues,
        enumValueSummaries: Object.keys(enumValueSummaries).length ? enumValueSummaries : undefined
    };
}