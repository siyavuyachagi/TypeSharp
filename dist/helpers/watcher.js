import * as fs from 'fs';
export function watchDirectory(dir, callback) {
    return fs.watch(dir, { recursive: true }, callback);
}
//# sourceMappingURL=watcher.js.map