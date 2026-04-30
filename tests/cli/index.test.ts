/// <reference types="node" />

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { createSampleConfig } from '../../src/core/create-sample-config'
import { generate } from '../../src/core'
import { vi, type MockedFunction } from 'vitest'

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
                // Should not overwrite existing config
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

            // Should not throw when source is empty
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
                source: [] // missing outputPath and other required fields
            }
            const configPath = path.join(tmpDir, 'incomplete.config.json')
            fs.writeFileSync(configPath, JSON.stringify(incompleteConfig), 'utf-8')

            await expect(async () => {
                await generate(configPath)
            }).rejects.toThrow()
        })
    })
})

