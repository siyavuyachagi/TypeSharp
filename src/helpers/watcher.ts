import * as fs from 'fs';

export type WatchCallback = (eventType: string, filename: string | null) => void;

export function watchDirectory(dir: string, callback: WatchCallback): fs.FSWatcher {
    return fs.watch(dir, { recursive: true }, callback);
}