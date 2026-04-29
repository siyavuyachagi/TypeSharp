import * as fs from 'fs';
export type WatchCallback = (eventType: string, filename: string | null) => void;
export declare function watchDirectory(dir: string, callback: WatchCallback): fs.FSWatcher;
//# sourceMappingURL=watcher.d.ts.map