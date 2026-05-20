// tests/intergration/real.project.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { parseCSharpFiles } from "../../src/parser/index.ts";
import { generateTypeScriptFiles } from "../../src/generator/index.ts";
import type { TypeSharpConfig } from "../../src/types/index.ts";

let generationError: Error | null = null;
let testOutputPath: string;
let testProjectDir: string;
let config: TypeSharpConfig;

function createTestProject(): { dir: string; csproj: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-integration-'));
    const csproj = path.join(dir, 'Test.csproj');
    fs.writeFileSync(csproj, `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>`);

    // User.cs
    fs.writeFileSync(path.join(dir, 'User.cs'), `
using System;
using System.Collections.Generic;

[TypeSharp]
public class User
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public string Email { get; set; } = string.Empty;
    public DateOnly? DateOfBirth { get; set; }
    public ICollection<UserRoleCode> Roles { get; set; } = new List<UserRoleCode>();
    public ICollection<string> Permissions { get; set; } = new List<string>();
}
  `);

    // Employee.cs
    fs.writeFileSync(path.join(dir, 'Employee.cs'), `
using System;

[TypeSharp]
public class Employee
{
    public int Id { get; set; }
    public string Department { get; set; } = string.Empty;

    [Obsolete("Use employeeCode instead.")]
    public string LegacyCode { get; set; } = string.Empty;
}

[TypeSharp]
public class Developer : Employee
{
    public string PrimaryLanguage { get; set; } = string.Empty;
}
  `);

    // UserRoleCode.cs
    fs.writeFileSync(path.join(dir, 'UserRoleCode.cs'), `
[TypeSharp]
public enum UserRoleCode
{
    Admin,
    User,
    Guest
}
  `);

    // Gender.cs
    fs.writeFileSync(path.join(dir, 'Gender.cs'), `
using System;

[TypeSharp, Union]
public enum Gender
{
    Male,
    Female,
    NonBinary,
    Other
}
  `);

    // ApiResponse.cs
    fs.writeFileSync(path.join(dir, 'ApiResponse.cs'), `
[TypeSharp]
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public T Data { get; set; } = default!;
    public List<string> Errors { get; set; } = new List<string>();
}
  `);

    // Department.cs
    fs.writeFileSync(path.join(dir, 'Department.cs'), `
using System;

[TypeSharp]
public class Department
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
}
  `);

    // LegalInformationCreateDto.cs
    fs.writeFileSync(path.join(dir, 'LegalInformationCreateDto.cs'), `
[TypeSharp]
public class LegalInformationCreateDto
{
    public string? RegistrationNumber { get; set; }
    public string? VatNumber { get; set; }
}
  `);

    // OrganizationLegalInformationCreateDto.cs
    fs.writeFileSync(path.join(dir, 'OrganizationLegalInformationCreateDto.cs'), `
using Microsoft.AspNetCore.Http;

[TypeSharp]
public class OrganizationLegalInformationCreateDto : LegalInformationCreateDto
{
    public IFormFile ConstitutionDocument { get; set; } = default!;
    public IFormFile ProofOfRegistrationDocument { get; set; } = default!;
}
  `);

    return { dir, csproj };
}

describe('TypeSharp - Real Project Integration', () => {
    beforeAll(async () => {
        try {
            const { dir, csproj } = createTestProject();
            testProjectDir = dir;
            testOutputPath = path.join(dir, '.generated');

            config = {
                source: [csproj],
                outputPath: testOutputPath,
                singleOutputFile: false,
                namingConvention: 'snake',
            };

            if (fs.existsSync(config.outputPath)) {
                fs.rmSync(config.outputPath, { recursive: true, force: true });
            }

            const results = await parseCSharpFiles(config);
            if (results.length === 0) {
                throw new Error(`No C# files found with [TypeSharp] attribute`);
            }

            generateTypeScriptFiles(config, results);
        } catch (error) {
            generationError = error instanceof Error ? error : new Error(String(error));
        }
    });

    afterAll(() => {
        if (testProjectDir && fs.existsSync(testProjectDir)) {
            fs.rmSync(testProjectDir, { recursive: true, force: true });
        }
    });

    // ─── Generation ───────────────────────────────────────────────────────────
    describe('Generation', () => {
        it('runs without throwing', () => {
            expect(generationError).toBeNull()
        })

        it('creates the output directory', () => {
            expect(fs.existsSync(config.outputPath)).toBe(true)
        })

        it('generates at least one .ts file', () => {
            const files = getAllFiles(config.outputPath).filter(f => f.endsWith('.ts'))
            expect(files.length).toBeGreaterThan(0)
        })
    })


    // ─── File content ─────────────────────────────────────────────────────────
    describe('Generated file content', () => {
        it('every generated file has the TypeSharp header', () => {
            const files = getAllFiles(config.outputPath).filter(f => f.endsWith('.ts'))
            for (const file of files) {
                const content = fs.readFileSync(file, 'utf-8')
                expect(content).toContain('Auto-generated by TypeSharp')
            }
        })

        it('every generated file has at least one export', () => {
            const files = getAllFiles(config.outputPath).filter(f => f.endsWith('.ts'))
            for (const file of files) {
                const content = fs.readFileSync(file, 'utf-8')
                expect(content).toMatch(/export (interface|enum|const)/)
            }
        })

        it('no generated file contains raw C# types', () => {
            const csharpTypes = ['List<', 'IEnumerable<', 'Dictionary<', 'IFormFile ', 'Guid ', 'DateTime ']
            const files = getAllFiles(config.outputPath).filter(f => f.endsWith('.ts'))
            for (const file of files) {
                const content = fs.readFileSync(file, 'utf-8')
                for (const csharpType of csharpTypes) {
                    expect(content).not.toContain(csharpType)
                }
            }
        })
    })

    // ─── Known DTOs ───────────────────────────────────────────────────────────
    describe('Known DTOs', () => {
        it('generates User', () => {
            const file = findFileContaining(config.outputPath, 'User')
            expect(file).not.toBeNull()
        })

        it('Developer extends Employee', () => {
            const file = findFileContaining(config.outputPath, 'Employee')
            if (!file) return
            const content = fs.readFileSync(file, 'utf-8')
            expect(content).toContain('extends Employee')
        })

        it('generates User output file with correct fields', () => {
            const file = findFileContaining(config.outputPath, 'User')
            if (!file) return
            const content = fs.readFileSync(file, 'utf-8')
            expect(content).toContain('id')
            expect(content).toContain('name')
            expect(content).toContain('email')
        })

        it('generates User (stacked attributes)', () => {
            const file = findFileContaining(config.outputPath, 'User')
            expect(file).not.toBeNull()
            if (!file) return
            const content = fs.readFileSync(file, 'utf-8')
            expect(content).toContain('id')
            expect(content).toContain('name')
        })

        it('generates UserRoleCode enum', () => {
            const file = findFileContaining(config.outputPath, 'UserRoleCode')
            expect(file).not.toBeNull()
        })

        it('generates Department with Guid mapped to string', () => {
            const file = findFileContaining(config.outputPath, 'Department')
            expect(file).not.toBeNull()
            if (!file) return
            const content = fs.readFileSync(file, 'utf-8')
            expect(content).toContain('id')
            expect(content).not.toMatch(/:\s*Guid/)
            expect(content).toContain('string')
        })

        it('generates LegalInformationCreateDto', () => {
            const file = findFileContaining(config.outputPath, 'LegalInformationCreateDto')
            expect(file).not.toBeNull()
            if (!file) return
            const content = fs.readFileSync(file, 'utf-8')
            expect(content).toContain('registrationNumber')
            expect(content).toContain('vatNumber')
            expect(content).toContain('| null')
        })

        it('OrganizationLegalInformationCreateDto extends LegalInformationCreateDto', () => {
            const file = findFileContaining(config.outputPath, 'OrganizationLegalInformationCreateDto')
            expect(file).not.toBeNull()
            if (!file) return
            const content = fs.readFileSync(file, 'utf-8')
            expect(content).toContain('extends LegalInformationCreateDto')
        })

        it('OrganizationLegalInformationCreateDto has IFormFile mapped to File', () => {
            const file = findFileContaining(config.outputPath, 'OrganizationLegalInformationCreateDto')
            if (!file) return
            const content = fs.readFileSync(file, 'utf-8')
            expect(content).toContain('constitutionDocument: File')
            expect(content).toContain('proofOfRegistrationDocument: File')
        })

        it('generates ApiResponse<T> with generic parameter', () => {
            const file = findFileContaining(config.outputPath, 'ApiResponse')
            expect(file).not.toBeNull()
            if (!file) return
            const content = fs.readFileSync(file, 'utf-8')
            expect(content).toContain('ApiResponse<T>')
            expect(content).toContain('success: boolean')
            expect(content).toContain('message: string | null')
            expect(content).toContain('data: T')
            expect(content).toContain('errors: string[]')
        })

        it('generates Employee with primitive properties', () => {
            const file = findFileContaining(config.outputPath, 'export interface Employee')
            expect(file).not.toBeNull()
            if (!file) return
            const content = fs.readFileSync(file, 'utf-8')
            expect(content).toContain('id: number')
            expect(content).toContain('department: string')
        })

        it('deprecated properties have @deprecated JSDoc comment', () => {
            const file = findFileContaining(config.outputPath, 'export interface Employee');
            if (!file) return;
            const content = fs.readFileSync(file, 'utf-8');
            expect(content).toContain('@deprecated');
        });
    })

    // ─── Type correctness ─────────────────────────────────────────────────────
    describe('Type correctness', () => {
        it('nullable properties have | null', () => {
            const file = findFileContaining(config.outputPath, 'User')
            if (!file) return
            const content = fs.readFileSync(file, 'utf-8')

            expect(content).toMatch(/name.*null/)
            expect(content).toMatch(/dateOfBirth.*null/)
        })

        it('no raw Guid type — should be string', () => {
            const files = getAllFiles(config.outputPath).filter(f => f.endsWith('.ts'))
            for (const file of files) {
                const content = fs.readFileSync(file, 'utf-8')
                expect(content).not.toMatch(/:\s*Guid/)
            }
        })

        it('no raw DateTime type — should be string or Date', () => {
            const files = getAllFiles(config.outputPath).filter(f => f.endsWith('.ts'))

            for (const file of files) {
                const content = fs.readFileSync(file, 'utf-8')
                expect(content).not.toMatch(/:\s*DateTime/)
            }
        })

        it('ICollection<UserRoleCode> on User.Roles maps to UserRoleCode[]', () => {
            const file = findFileContaining(config.outputPath, 'roles')
            if (!file) return
            const content = fs.readFileSync(file, 'utf-8')
            expect(content).toMatch(/roles.*UserRoleCode\[\]/)
        })

        it('ICollection<string> on User.Permissions maps to string[]', () => {
            const file = findFileContaining(config.outputPath, 'permissions')
            if (!file) return
            const content = fs.readFileSync(file, 'utf-8')
            expect(content).toMatch(/permissions.*string\[\]/)
        })

        it('DateOnly? maps to string | null', () => {
            const file = findFileContaining(config.outputPath, 'User')
            if (!file) return
            const content = fs.readFileSync(file, 'utf-8')
            expect(content).toMatch(/dateOfBirth.*string \| null/)
        })

        it('OrganizationLegalInformationCreateDto imports LegalInformationCreateDto', () => {
            const file = findFileContaining(config.outputPath, 'OrganizationLegalInformationCreateDto')
            if (!file) return
            const content = fs.readFileSync(file, 'utf-8')
            expect(content).toContain("import type { LegalInformationCreateDto }")
        })
    })
})


// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAllFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return []
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    return entries.flatMap(entry => {
        const fullPath = path.join(dir, entry.name)
        return entry.isDirectory() ? getAllFiles(fullPath) : [fullPath]
    })
}

function findFileContaining(dir: string, text: string): string | null {
    const files = getAllFiles(dir).filter(f => f.endsWith('.ts'))
    return files.find(f => fs.readFileSync(f, 'utf-8').includes(text)) ?? null
}