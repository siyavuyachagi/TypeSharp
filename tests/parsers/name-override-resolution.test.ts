import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseCSharpFiles } from '../../src/parser';
import { generateTypeScriptFiles } from '../../src/generator';
import type { TypeSharpConfig } from '../../src/types';

let tmpDir: string;
let outputDir: string;

function writeFile(name: string, content: string) {
    fs.writeFileSync(path.join(tmpDir, name), content);
}

function getAllFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? getAllFiles(full) : [full];
    });
}

function findFileContaining(dir: string, text: string): string | null {
    const files = getAllFiles(dir).filter(f => f.endsWith('.ts'));
    return files.find(f => fs.readFileSync(f, 'utf-8').includes(text)) ?? null;
}

function config(): TypeSharpConfig {
    return {
        source: [path.join(tmpDir, 'Test.csproj')],
        outputPath: outputDir,
        singleOutputFile: false,
        namingConvention: 'camel',
    };
}

beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-name-override-'));
    outputDir = path.join(tmpDir, '.generated');

    fs.writeFileSync(
        path.join(tmpDir, 'Test.csproj'),
        `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>`
    );

    // Renamed generic base — the originally reported bug case
    writeFile('Result.cs', `
        namespace Test {
            [TypeSharp("GenericResult")]
            public class Result<T> {
                public bool Succeeded { get; set; }
                public T? Data { get; set; }
            }
        }
    `);

    // Cross-file inheritor of the renamed base — not itself renamed
    writeFile('PagedResult.cs', `
        namespace Test {
            [TypeSharp]
            public class PagedResult<T> : Result<T> {
                public int PageNumber { get; set; }
            }
        }
    `);

    // Cross-file property referencing the renamed generic base
    writeFile('Envelope.cs', `
        namespace Test {
            [TypeSharp]
            public class Envelope {
                public Result<string> Payload { get; set; }
            }
        }
    `);
});

afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('[TypeSharp("name")] override resolution across references', () => {
    it('the renamed class itself is emitted under the overridden name only', async () => {
        const results = await parseCSharpFiles(config());
        const classes = results.flatMap(r => r.classes);

        expect(classes.find(c => c.name === 'GenericResult')).toBeDefined();
        expect(classes.find(c => c.name === 'Result')).toBeUndefined();
    });

    it('rewrites a cross-file inheritsFrom to the overridden base name', async () => {
        const results = await parseCSharpFiles(config());
        generateTypeScriptFiles(config(), results);

        const file = findFileContaining(outputDir, 'PagedResult');
        expect(file).not.toBeNull();
        const content = fs.readFileSync(file!, 'utf-8');

        expect(content).toContain('GenericResult');
        // bare "Result" (not part of "GenericResult" or "PagedResult") must not remain
        expect(content).not.toMatch(/\bResult\b/);
    });

    it('rewrites a cross-file property type referencing the renamed generic class', async () => {
        const results = await parseCSharpFiles(config());
        generateTypeScriptFiles(config(), results);

        const file = findFileContaining(outputDir, 'Envelope');
        expect(file).not.toBeNull();
        const content = fs.readFileSync(file!, 'utf-8');

        expect(content).toContain('GenericResult');
        expect(content).not.toMatch(/\bResult\b/);
    });
});