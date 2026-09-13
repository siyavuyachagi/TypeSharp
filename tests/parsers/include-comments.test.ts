import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseCSharpFiles } from '../../src/parser';
import { generateTypeScriptFiles } from '../../src/generator';
import { makeTempProject, cleanupTempProjects, makeTempProjectWithFiles } from './_utils';

const CS_SOURCE = `
namespace Test {
    /// <summary>
    /// Represents a user role in the system
    /// </summary>
    [TypeSharp]
    public enum RoleCode {
        /// <summary>
        /// Platform level, unscoped access
        /// </summary>
        Administrator,
        /// <summary>
        /// President, Vice President, Secretary
        /// </summary>
        Leadership,
        Player
    }

    /// <summary>
    /// A basic user profile
    /// </summary>
    [TypeSharp]
    public class UserDto {
        /// <summary>
        /// The user's display name
        /// </summary>
        public string Name { get; set; }
        public int Age { get; set; }
    }
}
`;


const ROLE_CS_SOURCE = `
namespace Test {
    [TypeSharp]
    public enum RoleCode {
        /// <summary>
        /// Platform level, unscoped access
        /// </summary>
        Administrator,

        /// <summary>
        /// President, Vice President, Secretary
        /// </summary>
        Leadership,

        Player
    }
}
`;

const USER_CS_SOURCE = `
namespace Test {
    [TypeSharp]
    public class UserDto {
        /// <summary>
        /// The user's display name
        /// </summary>
        public string Name { get; set; }

        public int Age { get; set; }
    }
}
`;
describe('includeComments option', () => {
    it('defaults to false — no summaries captured when omitted', async () => {
        const { csproj } = makeTempProject(CS_SOURCE);
        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const classes = results.flatMap(r => r.classes);

        const role = classes.find(c => c.name === 'RoleCode');
        const user = classes.find(c => c.name === 'UserDto');

        expect(role?.summary).toBeUndefined();
        expect(role?.enumValueSummaries).toBeUndefined();
        expect(user?.summary).toBeUndefined();
        expect(user?.properties.find(p => p.name === 'Name')?.summary).toBeUndefined();
    });

    it('captures class and property summaries when includeComments is true', async () => {
        const { csproj } = makeTempProject(CS_SOURCE);
        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out', includeComments: true });
        const user = results.flatMap(r => r.classes).find(c => c.name === 'UserDto');

        expect(user?.summary).toBe('A basic user profile');
        expect(user?.properties.find(p => p.name === 'Name')?.summary).toBe("The user's display name");
        expect(user?.properties.find(p => p.name === 'Age')?.summary).toBeUndefined();
    });

    it('captures enum-level and per-member summaries without corrupting comma-bearing member text', async () => {
        const { csproj } = makeTempProject(CS_SOURCE);
        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out', includeComments: true });
        const role = results.flatMap(r => r.classes).find(c => c.name === 'RoleCode');

        expect(role?.summary).toBe('Represents a user role in the system');
        expect(role?.enumValues).toEqual(['Administrator', 'Leadership', 'Player']);
        expect(role?.enumValueSummaries?.['Administrator']).toBe('Platform level, unscoped access');
        expect(role?.enumValueSummaries?.['Leadership']).toBe('President, Vice President, Secretary');
        expect(role?.enumValueSummaries?.['Player']).toBeUndefined();
    });

    it('emits per-member JSDoc in generated enum output when includeComments is true', async () => {
        const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-comments-gen-'));
        try {
            const { csproj } = makeTempProjectWithFiles({ 'RoleCode.cs': ROLE_CS_SOURCE, 'UserDto.cs': USER_CS_SOURCE, });
            const config = { source: csproj, outputPath: outputDir, singleOutputFile: false, namingConvention: 'camel' as const, includeComments: true, };
            const results = await parseCSharpFiles(config); generateTypeScriptFiles(config, results); const files = fs.readdirSync(outputDir, { recursive: true, }) as string[];
            const roleFile = files.find(f => path.basename(f).toLowerCase() === 'rolecode.ts');
            expect(roleFile).toBeDefined(); const content = fs.readFileSync(path.join(outputDir, roleFile as string), 'utf-8');
            expect(content).toContain('Platform level, unscoped access');
            expect(content).toContain('President, Vice President, Secretary');
        } finally {
            fs.rmSync(outputDir, { recursive: true, force: true });
        }
    });

    it('omits JSDoc from generated enum output when includeComments is false (default)', async () => {
        const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-no-comments-gen-'));
        try {
            const { csproj } = makeTempProjectWithFiles({ 'RoleCode.cs': ROLE_CS_SOURCE, 'UserDto.cs': USER_CS_SOURCE, });
            const config = { source: csproj, outputPath: outputDir, singleOutputFile: false, namingConvention: 'camel' as const, };
            const results = await parseCSharpFiles(config); generateTypeScriptFiles(config, results);
            const files = fs.readdirSync(outputDir, { recursive: true, }) as string[]; const roleFile = files.find(f => path.basename(f).toLowerCase() === 'rolecode.ts');
            expect(roleFile).toBeDefined();
            const content = fs.readFileSync(path.join(outputDir, roleFile as string), 'utf-8');
            expect(content).toContain('Auto-generated by TypeSharp');

            expect(content).not.toContain('Platform level, unscoped access');
            expect(content).not.toContain('President, Vice President, Secretary');
        } finally {
            fs.rmSync(outputDir, { recursive: true, force: true });
        }
    });
});

afterAll(() => cleanupTempProjects());