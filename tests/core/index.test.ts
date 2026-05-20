/// <reference types="node" />
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os'
import { TypeSharpConfig } from '../../src/types/typesharp-config.ts';
import { generate, mergeWithDefaults } from '../../src/core/index.ts'
import { createSampleConfig } from '../../src/core/create-sample-config.ts';
import path from 'path';

describe("Generate default config", () => {
    it('should allow opptional fields on all config formats (.ts | .js | .json)', () => {
        const testSource = ['C:/test/project.csproj'];
        const tsConfig: TypeSharpConfig = {
            source: testSource,
            outputPath: "./tests/.generated",
        };

        const jsConfig = {
            source: testSource,
            outputPath: "./tests/.generated",
        }

        const jsonConfig = {
            "source": testSource,
            "outputPath": "./app/types",
        }

        const configFiles = [tsConfig, jsConfig, jsonConfig]
        configFiles.forEach(config => {
            const outputConfig = mergeWithDefaults(config)

            expect(outputConfig.singleOutputFile).toBeDefined()
            expect(outputConfig.namingConvention).toBeDefined()
        })
    })
})



describe('createSampleConfig()', () => {
    const configFiles = [
        'typesharp.config.ts',
        'typesharp.config.js',
        'typesharp.config.json',
    ];

    function cleanupConfigs() {
        for (const file of configFiles) {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        }
    }
    beforeEach(cleanupConfigs);
    afterEach(cleanupConfigs);

    it('should create a .ts config file', () => {
        createSampleConfig('ts');
        expect(fs.existsSync('typesharp.config.ts')).toBe(true);
    });

    it('should create a .js config file', () => {
        createSampleConfig('js');
        expect(fs.existsSync('typesharp.config.js')).toBe(true);
    });

    it('should create a .json config file', () => {
        createSampleConfig('json');
        expect(fs.existsSync('typesharp.config.json')).toBe(true);
    });

    it('should not create a .js config if a .ts config already exists', () => {
        createSampleConfig('ts');
        createSampleConfig('js');
        expect(fs.existsSync('typesharp.config.js')).toBe(false);
    });

    it('should not create a .json config if a .ts config already exists', () => {
        createSampleConfig('ts');
        createSampleConfig('json');
        expect(fs.existsSync('typesharp.config.json')).toBe(false);
    });

    it('should not create a .ts config if a .js config already exists', () => {
        createSampleConfig('js');
        createSampleConfig('ts');
        expect(fs.existsSync('typesharp.config.ts')).toBe(false);
    });

    it('should not overwrite an existing config of the same format', () => {
        createSampleConfig('json');
        fs.writeFileSync('typesharp.config.json', '{ "modified": true }');
        createSampleConfig('json');
        const afterContent = fs.readFileSync('typesharp.config.json', 'utf-8');
        expect(afterContent).toBe('{ "modified": true }');
    });
});








describe('CLI - Command Line Interface', () => {
    let tmpDir: string
    let originalCwd: string

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'typesharp-cli-test-'))
        originalCwd = process.cwd()
        process.chdir(tmpDir)
    })

    afterEach(() => {
        process.chdir(originalCwd)
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    describe('init command (createSampleConfig)', () => {
        it('creates a sample .ts config file by default', () => {
            createSampleConfig('ts')
            expect(fs.existsSync(path.join(tmpDir, 'typesharp.config.ts'))).toBe(true)
        })

        it('creates a sample .js config file', () => {
            createSampleConfig('js')
            expect(fs.existsSync(path.join(tmpDir, 'typesharp.config.js'))).toBe(true)
        })

        it('creates a sample .json config file', () => {
            createSampleConfig('json')
            expect(fs.existsSync(path.join(tmpDir, 'typesharp.config.json'))).toBe(true)
        })

        it('generated .ts config is valid TypeScript', () => {
            createSampleConfig('ts')
            const content = fs.readFileSync(path.join(tmpDir, 'typesharp.config.ts'), 'utf-8')
            expect(content).toContain('TypeSharpConfig')
            expect(content).toContain('source:')
            expect(content).toContain('outputPath:')
        })

        it('generated .js config is valid JavaScript', () => {
            createSampleConfig('js')
            const content = fs.readFileSync(path.join(tmpDir, 'typesharp.config.js'), 'utf-8')
            expect(content).toContain('module.exports')
            expect(content).toContain('source:')
        })

        it('generated .json config is valid JSON', () => {
            createSampleConfig('json')
            const content = fs.readFileSync(path.join(tmpDir, 'typesharp.config.json'), 'utf-8')
            expect(() => JSON.parse(content)).not.toThrow()
        })

        it('does not overwrite existing config', () => {
            const configPath = path.join(tmpDir, 'typesharp.config.ts')
            fs.writeFileSync(configPath, '// Custom config', 'utf-8')

            createSampleConfig('ts')
            const content = fs.readFileSync(configPath, 'utf-8')
            expect(content).toContain('Custom config')
        })

        it('does not overwrite existing config', () => {
            const configPath = path.join(tmpDir, 'typesharp.config.ts')
            fs.writeFileSync(configPath, 'existing config', 'utf-8')

            const originalCwd = process.cwd()
            try {
                process.chdir(tmpDir)
                createSampleConfig('ts')
                expect(fs.readFileSync(configPath, 'utf-8')).toBe('existing config')
            } finally {
                process.chdir(originalCwd)
            }
        })
    })

    describe('generate command', () => {
        it('accepts empty source array gracefully', async () => {
            const configPath = path.join(tmpDir, 'typesharp.config.json')
            fs.writeFileSync(configPath, JSON.stringify({
                source: [],
                outputPath: './output',
                singleOutputFile: false
            }), 'utf-8')

            await expect(async () => {
                await generate(configPath)
            }).not.toThrow()
        })

        it('accepts missing config file gracefully', async () => {
            const configPath = path.join(tmpDir, 'nonexistent.config.json')

            await expect(async () => {
                await generate(configPath)
            }).rejects.toThrow()
        })

        it('handles missing config file gracefully', async () => {
            await expect(async () => {
                await generate('/nonexistent/path/config.json')
            }).rejects.toThrow()
        })

        it('accepts valid config file paths', async () => {
            const configPath = path.join(tmpDir, 'typesharp.config.json')
            fs.writeFileSync(configPath, JSON.stringify({
                source: [],
                outputPath: './output',
                singleOutputFile: false
            }), 'utf-8')

            await expect(async () => {
                await generate(configPath)
            }).not.toThrow()
        })

        it('does not throw when source is an array of .csproj paths', async () => {
            const configPath = path.join(tmpDir, 'typesharp.config.json')
            fs.writeFileSync(configPath, JSON.stringify({
                source: [
                    'C:/nonexistent/Project.csproj',
                    'C:/nonexistent/Other.csproj'
                ],
                outputPath: './output',
                singleOutputFile: false
            }), 'utf-8')

            await expect(async () => {
                await generate(configPath)
            }).not.toThrow()
        })
    })

    describe('Configuration file formats', () => {
        it('supports TypeScript config files', () => {
            createSampleConfig('ts')
            const content = fs.readFileSync(path.join(tmpDir, 'typesharp.config.ts'), 'utf-8')
            expect(content).toContain('export default')
            expect(content).toContain('import type')
        })

        it('supports JavaScript config files', () => {
            createSampleConfig('js')
            const content = fs.readFileSync(path.join(tmpDir, 'typesharp.config.js'), 'utf-8')
            expect(content).toContain('module.exports')
        })

        it('supports JSON config files', () => {
            createSampleConfig('json')
            const content = fs.readFileSync(path.join(tmpDir, 'typesharp.config.json'), 'utf-8')
            const parsed = JSON.parse(content)
            expect(parsed).toHaveProperty('source')
            expect(parsed).toHaveProperty('outputPath')
        })
    })

    describe('Error handling', () => {
        it('rejects invalid config format during generation', async () => {
            const configPath = path.join(tmpDir, 'bad.config.json')
            fs.writeFileSync(configPath, '{invalid json}', 'utf-8')

            await expect(async () => {
                await generate(configPath)
            }).rejects.toThrow()
        })

        it('throws on missing required config fields', async () => {
            const incompleteConfig = {
                source: []
            }
            const configPath = path.join(tmpDir, 'incomplete.config.json')
            fs.writeFileSync(configPath, JSON.stringify(incompleteConfig), 'utf-8')

            await expect(async () => {
                await generate(configPath)
            }).rejects.toThrow()
        })
    })
})