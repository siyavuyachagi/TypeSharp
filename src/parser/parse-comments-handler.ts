/**
 * Remove single-line and multi-line comments
 */
export function removeComments(content: string): string {
    let result = content.replace(/\/\*[\s\S]*?\*\//g, '');
    result = result
        .split('\n')
        .map(line => {
            if (line.trimStart().startsWith('///')) return line; // preserve XML doc comments
            const idx = line.indexOf('//');
            return idx === -1 ? line : line.slice(0, idx);
        })
        .join('\n');
    return result;
}


/**
 * Walk backward from `beforeIndex` collecting a contiguous block of `///` lines
 * (skipping blank lines and single-line attributes above the target so summaries
 * on classes/records/enums — which sit above their [TypeSharp] attribute — are
 * still found), then extract the <summary> text if present.
 */
export function extractDocSummary(text: string, beforeIndex: number): string | undefined {
    const lines = text.slice(0, beforeIndex).split('\n');
    const commentLines: string[] = [];

    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i]!.trim();
        if (line === '') {
            if (commentLines.length > 0) break;
            continue;
        }
        if (line.startsWith('///')) {
            commentLines.unshift(line.replace(/^\/\/\/\s?/, ''));
            continue;
        }
        if (/^\[.*\]$/.test(line) && commentLines.length === 0) {
            continue; // skip attribute lines above, before any comment is found
        }
        break;
    }

    if (commentLines.length === 0) return undefined;

    const joined = commentLines.join('\n');
    const summaryMatch = joined.match(/<summary>([\s\S]*?)<\/summary>/);
    const summaryText = summaryMatch ? summaryMatch[1]! : joined;

    return summaryText
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .join(' ')
        .trim() || undefined;
}