/**
 * Remove single-line and multi-line comments
 */
export declare function removeComments(content: string): string;
/**
 * Walk backward from `beforeIndex` collecting a contiguous block of `///` lines
 * (skipping blank lines and single-line attributes above the target so summaries
 * on classes/records/enums — which sit above their [TypeSharp] attribute — are
 * still found), then extract the <summary> text if present.
 */
export declare function extractDocSummary(text: string, beforeIndex: number): string | undefined;
//# sourceMappingURL=parse-comments-handler.d.ts.map