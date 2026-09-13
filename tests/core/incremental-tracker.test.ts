/// <reference types="node" />

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generate, getExpectedTsFilePath } from '../../src/core';
import type { TypeSharpConfig } from '../../src/types';

describe('getExpectedTsFilePath — separator-agnostic matching', () => {
    // These exercise the normalization the fix introduced. The most severe
    // form of this bug is Windows-only (native-separator .sln-derived source
    // vs. forward-slash glob() output), but mixed/relative separator forms
    // are reproducible on any OS and hit the same normalize() code path.
    it('matches when the C# file path uses forward slashes throughout', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-tracker-path-'));
        const projectDir = path.join(dir, 'MyApp');
        fs.mkdirSync(projectDir, { recursive: true });

        const config: TypeSharpConfig = {
            source: path.join(projectDir, 'MyApp.csproj'),
            outputPath: path.join(dir, 'out'),
            singleOutputFile: false,
            namingConvention: 'camel',
        };

        const csharpFilePath = path.join(projectDir, 'User.cs').split(path.sep).join('/');

        const result = getExpectedTsFilePath(config, csharpFilePath);
        expect(result).toBeDefined();
        expect(result?.toLowerCase()).toContain('user');

        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('returns undefined when the file does not belong to any configured source project', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-tracker-path2-'));

        const config: TypeSharpConfig = {
            source: path.join(dir, 'OtherApp', 'OtherApp.csproj'),
            outputPath: path.join(dir, 'out'),
            singleOutputFile: false,
            namingConvention: 'camel',
        };

        const result = getExpectedTsFilePath(config, path.join(dir, 'MyApp', 'User.cs'));
        expect(result).toBeUndefined();

        fs.rmSync(dir, { recursive: true, force: true });
    });
});

describe('generate() incremental — missing output regeneration', () => {
    let workDir: string;
    let projectDir: string;
    let originalCwd: string;

    function writeProject() {
        fs.writeFileSync(
            path.join(projectDir, 'Test.csproj'),
            `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>`
        );
        fs.writeFileSync(path.join(projectDir, 'User.cs'), `
            namespace Test {
                [TypeSharp]
                public class User {
                    public int Id { get; set; }
                    public string Name { get; set; }
                }
            }
        `);
    }

    beforeEach(() => {
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-tracker-work-'));
        projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-tracker-proj-'));
        originalCwd = process.cwd();
        process.chdir(workDir); // .typesharp tracker dir is cwd-relative
        writeProject();
    });

    afterEach(() => {
        process.chdir(originalCwd);
        fs.rmSync(workDir, { recursive: true, force: true });
        fs.rmSync(projectDir, { recursive: true, force: true });
    });

    it('regenerates a .ts file that was manually deleted, even though its C# source is unchanged', async () => {
        const outputDir = path.join(workDir, 'out');
        const configPath = path.join(workDir, 'typesharp.config.json');
        fs.writeFileSync(configPath, JSON.stringify({
            source: [path.join(projectDir, 'Test.csproj')],
            outputPath: outputDir,
            singleOutputFile: false,
            namingConvention: 'camel',
        }));

        await generate(configPath, true);
        const files1 = fs.readdirSync(outputDir).filter(f => f.endsWith('.ts'));
        expect(files1.length).toBe(1);
        const outFile = path.join(outputDir, files1[0]!);

        // Simulate the user manually deleting the generated output
        fs.unlinkSync(outFile);
        expect(fs.existsSync(outFile)).toBe(false);

        // Source hash is unchanged, but the missing output must still be detected and regenerated
        await generate(configPath, true);
        expect(fs.existsSync(outFile)).toBe(true);
    });

    it('still deletes the corresponding .ts file when its C# source is removed', async () => {
        const outputDir = path.join(workDir, 'out');
        const configPath = path.join(workDir, 'typesharp.config.json');
        fs.writeFileSync(configPath, JSON.stringify({
            source: [path.join(projectDir, 'Test.csproj')],
            outputPath: outputDir,
            singleOutputFile: false,
            namingConvention: 'camel',
        }));

        await generate(configPath, true);
        expect(fs.readdirSync(outputDir).filter(f => f.endsWith('.ts')).length).toBe(1);

        fs.unlinkSync(path.join(projectDir, 'User.cs'));

        await generate(configPath, true);
        expect(fs.readdirSync(outputDir).filter(f => f.endsWith('.ts')).length).toBe(0);
    });
});