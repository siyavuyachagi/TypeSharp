/// <reference types="node" />

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseProperties } from '../../src/parser/parse-properties'
import { generateTypeScriptFiles } from '../../src/generator'
import type { ParseResult, TypeSharpConfig } from '../../src/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

let outputDir: string

function makeConfig(outputPath: string): TypeSharpConfig {
    return {
        source: outputPath,
        outputPath,
        singleOutputFile: false,
        namingConvention: 'camel',
    }
}

function makeParseResult(className: string, classBody: string, outputDir: string): ParseResult {
    const filePath = path.join(outputDir, `${className}.cs`)
    fs.writeFileSync(filePath, `// dummy`)
    return {
        filePath,
        relativePath: `${className}.cs`,
        classes: [{
            name: className,
            properties: parseProperties(classBody),
            isEnum: false,
            isRecord: false,
        }]
    }
}

beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-region-test-'))
})

afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true })
})

// ─── parseProperties — region parsing ────────────────────────────────────────

describe('parseProperties() — #region tracking', () => {
    it('assigns region name to properties inside a #region block', () => {
        const body = `
            #region Identity
            public string Id { get; set; }
            public string Username { get; set; }
            #endregion
        `
        const props = parseProperties(body)
        expect(props.find(p => p.name === 'Id')?.region).toBe('Identity')
        expect(props.find(p => p.name === 'Username')?.region).toBe('Identity')
    })

    it('assigns undefined region to properties outside any #region block', () => {
        const body = `
            public string Id { get; set; }
            #region Contact
            public string Email { get; set; }
            #endregion
        `
        const props = parseProperties(body)
        expect(props.find(p => p.name === 'Id')?.region).toBeUndefined()
    })

    it('assigns correct region when multiple regions exist', () => {
        const body = `
            #region Identity
            public string Id { get; set; }
            #endregion
            #region Contact
            public string Email { get; set; }
            #endregion
        `
        const props = parseProperties(body)
        expect(props.find(p => p.name === 'Id')?.region).toBe('Identity')
        expect(props.find(p => p.name === 'Email')?.region).toBe('Contact')
    })

    it('assigns undefined to properties after #endregion with no new region', () => {
        const body = `
            #region Identity
            public string Id { get; set; }
            #endregion
            public string Extra { get; set; }
        `
        const props = parseProperties(body)
        expect(props.find(p => p.name === 'Extra')?.region).toBeUndefined()
    })

    it('handles a class with no regions — all properties have undefined region', () => {
        const body = `
            public string Id { get; set; }
            public string Name { get; set; }
        `
        const props = parseProperties(body)
        props.forEach(p => expect(p.region).toBeUndefined())
    })

    it('handles region names with spaces', () => {
        const body = `
            #region My Region Name
            public string Field { get; set; }
            #endregion
        `
        const props = parseProperties(body)
        expect(props.find(p => p.name === 'Field')?.region).toBe('My Region Name')
    })
})

// ─── generateTypeScriptFiles — region output ──────────────────────────────────

describe('generateTypeScriptFiles() — #region output', () => {
    it('emits // #region and // #endregion comments in the interface', () => {
        const body = `
            #region Identity
            public string Id { get; set; }
            #endregion
        `
        const result = makeParseResult('User', body, outputDir)
        generateTypeScriptFiles(makeConfig(outputDir), [result])

        const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.ts'))
        const content = fs.readFileSync(path.join(outputDir, files[0]!), 'utf-8')
        expect(content).toContain('// #region Identity')
        expect(content).toContain('// #endregion')
    })

    it('properties appear between their region markers', () => {
        const body = `
            #region Identity
            public string Id { get; set; }
            public string Username { get; set; }
            #endregion
        `
        const result = makeParseResult('User', body, outputDir)
        generateTypeScriptFiles(makeConfig(outputDir), [result])

        const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.ts'))
        const content = fs.readFileSync(path.join(outputDir, files[0]!), 'utf-8')

        const regionStart = content.indexOf('// #region Identity')
        const regionEnd = content.indexOf('// #endregion')
        const idPos = content.indexOf('id:')
        const usernamePos = content.indexOf('username:')

        expect(idPos).toBeGreaterThan(regionStart)
        expect(usernamePos).toBeGreaterThan(regionStart)
        expect(idPos).toBeLessThan(regionEnd)
        expect(usernamePos).toBeLessThan(regionEnd)
    })

    it('emits correct number of #region / #endregion pairs for multiple regions', () => {
        const body = `
            #region Identity
            public string Id { get; set; }
            #endregion
            #region Contact
            public string Email { get; set; }
            #endregion
        `
        const result = makeParseResult('User', body, outputDir)
        generateTypeScriptFiles(makeConfig(outputDir), [result])

        const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.ts'))
        const content = fs.readFileSync(path.join(outputDir, files[0]!), 'utf-8')

        const regionMatches = content.match(/\/\/ #region /g) ?? []
        const endregionMatches = content.match(/\/\/ #endregion/g) ?? []
        expect(regionMatches).toHaveLength(2)
        expect(endregionMatches).toHaveLength(2)
    })

    it('properties outside regions are not wrapped in region markers', () => {
        const body = `
            public string Id { get; set; }
            #region Contact
            public string Email { get; set; }
            #endregion
            public string Extra { get; set; }
        `
        const result = makeParseResult('User', body, outputDir)
        generateTypeScriptFiles(makeConfig(outputDir), [result])

        const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.ts'))
        const content = fs.readFileSync(path.join(outputDir, files[0]!), 'utf-8')

        const idPos = content.indexOf('id:')
        const extraPos = content.indexOf('extra:')
        const regionStart = content.indexOf('// #region')
        const regionEnd = content.lastIndexOf('// #endregion')

        expect(idPos).toBeLessThan(regionStart)
        expect(extraPos).toBeGreaterThan(regionEnd)
    })

    it('no region markers are emitted when class has no #region blocks', () => {
        const body = `
            public string Id { get; set; }
            public string Name { get; set; }
        `
        const result = makeParseResult('User', body, outputDir)
        generateTypeScriptFiles(makeConfig(outputDir), [result])

        const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.ts'))
        const content = fs.readFileSync(path.join(outputDir, files[0]!), 'utf-8')
        expect(content).not.toContain('// #region')
        expect(content).not.toContain('// #endregion')
    })

    it('blank line appears before #region when preceded by non-region properties', () => {
        const body = `
            public string Id { get; set; }
            #region Contact
            public string Email { get; set; }
            #endregion
        `
        const result = makeParseResult('User', body, outputDir)
        generateTypeScriptFiles(makeConfig(outputDir), [result])

        const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.ts'))
        const content = fs.readFileSync(path.join(outputDir, files[0]!), 'utf-8')

        // blank line immediately before // #region
        expect(content).toMatch(/\n\n\s*\/\/ #region/)
    })

    it('blank line appears after #endregion when followed by more properties', () => {
        const body = `
            #region Identity
            public string Id { get; set; }
            #endregion
            public string Extra { get; set; }
        `
        const result = makeParseResult('User', body, outputDir)
        generateTypeScriptFiles(makeConfig(outputDir), [result])

        const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.ts'))
        const content = fs.readFileSync(path.join(outputDir, files[0]!), 'utf-8')

        // blank line immediately after // #endregion
        expect(content).toMatch(/\/\/ #endregion\n\n/)
    })

    it('single blank line between adjacent regions — not two', () => {
        const body = `
            #region AAAA
            public string Id { get; set; }
            #endregion
            #region BBB
            public string Name { get; set; }
            #endregion
        `
        const result = makeParseResult('User', body, outputDir)
        generateTypeScriptFiles(makeConfig(outputDir), [result])

        const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.ts'))
        const content = fs.readFileSync(path.join(outputDir, files[0]!), 'utf-8')

        // must NOT have two blank lines between #endregion and #region
        expect(content).not.toMatch(/\/\/ #endregion\n\n\n/)
    })
})