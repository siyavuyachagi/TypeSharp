// src/helpers/change-tracker.ts
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const TYPESHARP_CACHE_DIR = '.typesharp';
const FILE_NAME = 'tracker.json';
const HASH_SNAPSHOT_FILE = path.join(TYPESHARP_CACHE_DIR, FILE_NAME);

/**
 * Load previous generation hashes
 */
export function loadPreviousHashes(): Map<string, string> {
  if (!fs.existsSync(HASH_SNAPSHOT_FILE)) {
    return new Map();
  }

  try {
    const data = JSON.parse(fs.readFileSync(HASH_SNAPSHOT_FILE, 'utf-8'));
    return new Map(Object.entries(data));
  } catch {
    return new Map();
  }
}

/**
 * Save current hashes for next generation
 */
export function savePreviousHashes(hashes: Map<string, string>): void {
  // Create .typesharp directory if it doesn't exist
  if (!fs.existsSync(TYPESHARP_CACHE_DIR)) {
    fs.mkdirSync(TYPESHARP_CACHE_DIR, { recursive: true });
  }

  const obj = Object.fromEntries(hashes);
  fs.writeFileSync(HASH_SNAPSHOT_FILE, JSON.stringify(obj, null, 2), 'utf-8');
}

export function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('md5').update(content).digest('hex');
}

export function getChangedFiles(
  allCSharpFiles: string[],
  previousHashes: Map<string, string>
): { changed: string[]; deleted: string[] } {
  const changed: string[] = [];
  const currentHashes = new Map<string, string>();

  for (const file of allCSharpFiles) {
    const hash = computeFileHash(file);
    currentHashes.set(file, hash);

    const prevHash = previousHashes.get(file);
    if (prevHash !== hash) {
      changed.push(file);
    }
  }

  const deleted: string[] = [];
  for (const [file] of previousHashes) {
    if (!currentHashes.has(file)) {
      deleted.push(file);
    }
  }

  return { changed, deleted };
}