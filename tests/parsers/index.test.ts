import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseCSharpFiles } from '../../src/parser';

function makeTempProject(csContent: string): { dir: string; csproj: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-parser-'));
  const csproj = path.join(dir, 'Test.csproj');
  fs.writeFileSync(csproj, `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>`);
  fs.writeFileSync(path.join(dir, 'Model.cs'), csContent);
  return { dir, csproj };
}

describe('Parser', () => {
  describe('[Obsolete] support', () => {
    it('marks a property with [Obsolete] as deprecated', async () => {
      const { csproj } = makeTempProject(`
        using System;
        namespace Test {
          [TypeSharp]
          public class Foo {
            public string Name { get; set; }
            [Obsolete]
            public string OldName { get; set; }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const foo = results.flatMap(r => r.classes).find(c => c.name === 'Foo');
      expect(foo).toBeDefined();

      const oldName = foo!.properties.find(p => p.name === 'OldName');
      expect(oldName?.isDeprecated).toBe(true);
      expect(oldName?.deprecationMessage).toBeUndefined();
    });

    it('captures the deprecation message from [Obsolete("...")]', async () => {
      const { csproj } = makeTempProject(`
        using System;
        namespace Test {
          [TypeSharp]
          public class Bar {
            [Obsolete("Use NewField instead.")]
            public string OldField { get; set; }
            public string NewField { get; set; }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const bar = results.flatMap(r => r.classes).find(c => c.name === 'Bar');
      const oldField = bar!.properties.find(p => p.name === 'OldField');

      expect(oldField?.isDeprecated).toBe(true);
      expect(oldField?.deprecationMessage).toBe('Use NewField instead.');
    });

    it('does NOT mark a normal property as deprecated', async () => {
      const { csproj } = makeTempProject(`
        namespace Test {
          [TypeSharp]
          public class Baz {
            public string ActiveField { get; set; }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const baz = results.flatMap(r => r.classes).find(c => c.name === 'Baz');
      const active = baz!.properties.find(p => p.name === 'ActiveField');

      expect(active?.isDeprecated).toBe(false);
    });

    it('handles [Obsolete] on expression-bodied property', async () => {
      const { csproj } = makeTempProject(`
        namespace Test {
          [TypeSharp]
          public class Computed {
            public string First { get; set; }
            [Obsolete("Use First.")]
            public string Full => First;
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const cls = results.flatMap(r => r.classes).find(c => c.name === 'Computed');
      const full = cls!.properties.find(p => p.name === 'Full');

      expect(full?.isDeprecated).toBe(true);
      expect(full?.deprecationMessage).toBe('Use First.');
    });

    it('does NOT bleed @deprecated onto properties after a deprecated one', async () => {
      const { csproj } = makeTempProject(`
        using System;
        namespace Test {
          [TypeSharp]
          public class Bleed {
            public string First { get; set; }
            [Obsolete("Old")]
            public string OldField { get; set; }
            public string AfterOld { get; set; }
            public string AlsoAfter { get; set; }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const cls = results.flatMap(r => r.classes).find(c => c.name === 'Bleed');
      expect(cls).toBeDefined();

      expect(cls!.properties.find(p => p.name === 'First')?.isDeprecated).toBe(false);
      expect(cls!.properties.find(p => p.name === 'OldField')?.isDeprecated).toBe(true);
      expect(cls!.properties.find(p => p.name === 'AfterOld')?.isDeprecated).toBe(false);
      expect(cls!.properties.find(p => p.name === 'AlsoAfter')?.isDeprecated).toBe(false);
    });
  });


  describe('[TypeSharp] attribute overrides', () => {
    it('[TypeIgnore] excludes the property', async () => {
      const { csproj } = makeTempProject(`
        namespace Test {
          [TypeSharp]
          public class Dto {
            public string Name { get; set; }
            [TypeIgnore]
            public string PasswordHash { get; set; }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const cls = results.flatMap(r => r.classes).find(c => c.name === 'Dto');
      expect(cls!.properties.find(p => p.name === 'PasswordHash')).toBeUndefined();
      expect(cls!.properties.find(p => p.name === 'Name')).toBeDefined();
    });

    it('[TypeName] overrides the property name', async () => {
      const { csproj } = makeTempProject(`
        namespace Test {
          [TypeSharp]
          public class Dto {
            [TypeName("created_at")]
            public DateTime CreatedAt { get; set; }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const cls = results.flatMap(r => r.classes).find(c => c.name === 'Dto');
      expect(cls!.properties.find(p => p.name === 'created_at')).toBeDefined();
      expect(cls!.properties.find(p => p.name === 'CreatedAt')).toBeUndefined();
    });

    it('[TypeAs] overrides the inferred type', async () => {
      const { csproj } = makeTempProject(`
        namespace Test {
          [TypeSharp]
          public class Dto {
            [TypeAs("Date")]
            public DateTime UpdatedAt { get; set; }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const cls = results.flatMap(r => r.classes).find(c => c.name === 'Dto');
      const prop = cls!.properties.find(p => p.name === 'UpdatedAt');
      expect(prop?.type).toBe('Date');
    });
  });


  describe('[TypeSharp("name")] class/enum name override', () => {
    it('overrides class name', async () => {
      const { csproj } = makeTempProject(`
        namespace Test {
          [TypeSharp("auth_response")]
          public class AuthResponse {
            public string AccessToken { get; set; }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const cls = results.flatMap(r => r.classes).find(c => c.name === 'auth_response');
      expect(cls).toBeDefined();
      expect(results.flatMap(r => r.classes).find(c => c.name === 'AuthResponse')).toBeUndefined();
    });

    it('overrides enum name', async () => {
      const { csproj } = makeTempProject(`
        namespace Test {
          [TypeSharp("user_role")]
          public enum UserRole {
            Admin,
            User,
            Guest
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const en = results.flatMap(r => r.classes).find(c => c.name === 'user_role');
      expect(en).toBeDefined();
      expect(en?.isEnum).toBe(true);
      expect(results.flatMap(r => r.classes).find(c => c.name === 'UserRole')).toBeUndefined();
    });

    it('[TypeSharp] without arg still works (no regression)', async () => {
      const { csproj } = makeTempProject(`
        namespace Test {
          [TypeSharp]
          public class UserDto {
            public string Name { get; set; }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const cls = results.flatMap(r => r.classes).find(c => c.name === 'UserDto');
      expect(cls).toBeDefined();
    });

    it('override name is used as-is, ignoring namingConvention', async () => {
      const { csproj } = makeTempProject(`
        namespace Test {
          [TypeSharp("my_custom_Name")]
          public class SomethingElse {
            public string Value { get; set; }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const cls = results.flatMap(r => r.classes).find(c => c.name === 'my_custom_Name');
      expect(cls).toBeDefined();
      expect(results.flatMap(r => r.classes).find(c => c.name === 'SomethingElse')).toBeUndefined();
    });
  });


  describe('Inheritance', () => {
    it('preserves class inheritance', async () => {
      const { csproj } = makeTempProject(`
        namespace Test {
          [TypeSharp]
          public class Base {
            public int Id { get; set; }
          }
          [TypeSharp]
          public class Child : Base {
            public string Name { get; set; }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const child = results.flatMap(r => r.classes).find(c => c.name === 'Child');
      expect(child?.inheritsFrom).toBe('Base');
    });

    it('ignores C# interfaces in inheritance (e.g. IActionResult)', async () => {
      const { csproj } = makeTempProject(`
        namespace Test {
          [TypeSharp]
          public class MyResult : IActionResult {
            public string Message { get; set; }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const cls = results.flatMap(r => r.classes).find(c => c.name === 'MyResult');
      expect(cls).toBeDefined();
      expect(cls!.inheritsFrom).toBeUndefined();
    });

    it('ignores C# interfaces but keeps concrete base class', async () => {
      const { csproj } = makeTempProject(`
        namespace Test {
          [TypeSharp]
          public class Base {
            public int Id { get; set; }
          }
          [TypeSharp]
          public class Child : Base, IDisposable {
            public string Name { get; set; }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const child = results.flatMap(r => r.classes).find(c => c.name === 'Child');
      expect(child?.inheritsFrom).toBe('Base');
    });
  });


  describe('Generic types', () => {
    it('parses a single generic parameter', async () => {
      const { csproj } = makeTempProject(`
      namespace Test {
        [TypeSharp]
        public class ApiResponse<T> {
          public bool Success { get; set; }
          public T Data { get; set; }
        }
      }
    `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const cls = results.flatMap(r => r.classes).find(c => c.name === 'ApiResponse');
      expect(cls).toBeDefined();
      expect(cls!.genericParameters).toEqual(['T']);
    });

    it('parses multiple generic parameters', async () => {
      const { csproj } = makeTempProject(`
      namespace Test {
        [TypeSharp]
        public class Result<TData, TError> {
          public bool IsSuccess { get; set; }
          public TData? Data { get; set; }
          public TError? Error { get; set; }
        }
      }
    `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const cls = results.flatMap(r => r.classes).find(c => c.name === 'Result');
      expect(cls).toBeDefined();
      expect(cls!.genericParameters).toEqual(['TData', 'TError']);
    });

    it('preserves generic parameters in inheritance', async () => {
      const { csproj } = makeTempProject(`
      namespace Test {
        [TypeSharp]
        public class ApiResponse<T> {
          public bool Success { get; set; }
          public T? Data { get; set; }
        }
        [TypeSharp]
        public class PagedApiResponse<T> : ApiResponse<T> {
          public int PageNumber { get; set; }
          public int TotalPages { get; set; }
        }
      }
    `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const cls = results.flatMap(r => r.classes).find(c => c.name === 'PagedApiResponse');
      expect(cls).toBeDefined();
      expect(cls!.genericParameters).toEqual(['T']);
      expect(cls!.inheritsFrom).toBe('ApiResponse');
      expect(cls!.baseClassGenerics).toEqual(['T']);
    });
  });


  describe('Nested classes', () => {
    it('extracts nested annotated class as standalone interface', async () => {
      const { csproj } = makeTempProject(`
        namespace Test {
          [TypeSharp]
          public class AuthResponse {
            public string AccessToken { get; set; }
            public string RefreshToken { get; set; }
            [TypeSharp]
            public class User {
              public string FirstName { get; set; }
              public string LastName { get; set; }
            }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const classes = results.flatMap(r => r.classes);

      const user = classes.find(c => c.name === 'User');
      expect(user).toBeDefined();
      expect(user!.properties.find(p => p.name === 'FirstName')).toBeDefined();
      expect(user!.properties.find(p => p.name === 'LastName')).toBeDefined();
    });

    it('injects a reference property on the parent pointing to the nested class', async () => {
      const { csproj } = makeTempProject(`
        namespace Test {
          [TypeSharp]
          public class AuthResponse {
            public string AccessToken { get; set; }
            public string RefreshToken { get; set; }
            [TypeSharp]
            public class User {
              public string FirstName { get; set; }
              public string LastName { get; set; }
            }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const classes = results.flatMap(r => r.classes);

      const authResponse = classes.find(c => c.name === 'AuthResponse');
      expect(authResponse).toBeDefined();

      expect(authResponse!.properties.find(p => p.name === 'FirstName')).toBeUndefined()
      const userProp = authResponse!.properties.find(p => p.name === 'user');
      expect(userProp).toBeDefined();
      expect(userProp!.type).toBe('User');
      expect(userProp!.isNullable).toBe(false);
      expect(userProp!.isArray).toBe(false);
    });

    it('does NOT bleed nested class properties into the parent', async () => {
      const { csproj } = makeTempProject(`
        namespace Test {
          [TypeSharp]
          public class AuthResponse {
            public string AccessToken { get; set; }
            [TypeSharp]
            public class User {
              public string FirstName { get; set; }
              public string Email { get; set; }
            }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const classes = results.flatMap(r => r.classes);

      const authResponse = classes.find(c => c.name === 'AuthResponse');
      expect(authResponse).toBeDefined();

      expect(authResponse!.properties.find(p => p.name === 'FirstName')).toBeUndefined();
      expect(authResponse!.properties.find(p => p.name === 'Email')).toBeUndefined();
    });

    it('respects [TypeSharp("name")] override on nested class', async () => {
      const { csproj } = makeTempProject(`
        namespace Test {
          [TypeSharp]
          public class AuthResponse {
            public string AccessToken { get; set; }
            [TypeSharp("AuthUser")]
            public class User {
              public string FirstName { get; set; }
            }
          }
        }
      `);

      const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
      const classes = results.flatMap(r => r.classes);

      const authUser = classes.find(c => c.name === 'AuthUser');
      expect(authUser).toBeDefined();

      const authResponse = classes.find(c => c.name === 'AuthResponse');
      const userProp = authResponse!.properties.find(p => p.name === 'user');
      expect(userProp!.type).toBe('AuthUser');
    });
  });


  // ─── Records ──────────────────────────────────────────────────────────────
  // ─── Records ──────────────────────────────────────────────────────────────
  describe('Records', () => {
    // ── Positional (primary constructor) ────────────────────────────────────
    describe('Positional records', () => {
      it('parses a simple positional record', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp]
            public record Point(int X, int Y);
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const cls = results.flatMap(r => r.classes).find(c => c.name === 'Point');
        expect(cls).toBeDefined();
        expect(cls!.isRecord).toBe(true);
        expect(cls!.properties.find(p => p.name === 'X')).toBeDefined();
        expect(cls!.properties.find(p => p.name === 'Y')).toBeDefined();
      });

      it('maps primitive types in positional parameters', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp]
            public record ProductSummary(int Id, string Name, decimal Price, bool IsActive);
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const cls = results.flatMap(r => r.classes).find(c => c.name === 'ProductSummary');
        expect(cls).toBeDefined();
        expect(cls!.properties.find(p => p.name === 'Id')?.type).toBe('number');
        expect(cls!.properties.find(p => p.name === 'Name')?.type).toBe('string');
        expect(cls!.properties.find(p => p.name === 'Price')?.type).toBe('number');
        expect(cls!.properties.find(p => p.name === 'IsActive')?.type).toBe('boolean');
      });

      it('handles nullable parameters', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp]
            public record UserRecord(int Id, string? DisplayName, DateOnly? DateOfBirth);
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const cls = results.flatMap(r => r.classes).find(c => c.name === 'UserRecord');
        expect(cls!.properties.find(p => p.name === 'Id')?.isNullable).toBe(false);
        expect(cls!.properties.find(p => p.name === 'DisplayName')?.isNullable).toBe(true);
        expect(cls!.properties.find(p => p.name === 'DateOfBirth')?.isNullable).toBe(true);
        expect(cls!.properties.find(p => p.name === 'DateOfBirth')?.type).toBe('string');
      });

      it('handles collection parameters (List<T>)', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp]
            public record OrderDto(int Id, List<string> Tags);
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const cls = results.flatMap(r => r.classes).find(c => c.name === 'OrderDto');
        const tags = cls!.properties.find(p => p.name === 'Tags');
        expect(tags?.isArray).toBe(true);
        expect(tags?.type).toBe('string');
      });

      it('handles Dictionary parameters', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp]
            public record ConfigDto(Dictionary<string, bool> Flags);
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const cls = results.flatMap(r => r.classes).find(c => c.name === 'ConfigDto');
        const flags = cls!.properties.find(p => p.name === 'Flags');
        expect(flags?.type).toBe('Record<string, boolean>');
        expect(flags?.isArray).toBe(false);
      });

      it('handles Guid and DateTime parameters', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp]
            public record AuditDto(Guid TraceId, DateTime CreatedAt);
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const cls = results.flatMap(r => r.classes).find(c => c.name === 'AuditDto');
        expect(cls!.properties.find(p => p.name === 'TraceId')?.type).toBe('string');
        expect(cls!.properties.find(p => p.name === 'CreatedAt')?.type).toBe('string');
      });
    });

    // ── Record class / record struct keywords ────────────────────────────────
    describe('record class and record struct', () => {
      it('parses "record class" syntax', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp]
            public record class AddressRecord(string Street, string City);
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const cls = results.flatMap(r => r.classes).find(c => c.name === 'AddressRecord');
        expect(cls).toBeDefined();
        expect(cls!.isRecord).toBe(true);
        expect(cls!.properties.length).toBe(2);
      });

      it('parses "record struct" syntax', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp]
            public record struct CoordRecord(double Lat, double Lng);
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const cls = results.flatMap(r => r.classes).find(c => c.name === 'CoordRecord');
        expect(cls).toBeDefined();
        expect(cls!.isRecord).toBe(true);
        expect(cls!.properties.find(p => p.name === 'Lat')?.type).toBe('number');
      });
    });

    // ── Body-only record (no primary constructor) ────────────────────────────
    describe('Body-only records', () => {
      it('parses a record with body properties instead of a primary constructor', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp]
            public record PersonRecord
            {
              public string FirstName { get; set; }
              public string LastName { get; set; }
              public int Age { get; set; }
            }
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const cls = results.flatMap(r => r.classes).find(c => c.name === 'PersonRecord');
        expect(cls).toBeDefined();
        expect(cls!.isRecord).toBe(true);
        expect(cls!.properties.find(p => p.name === 'FirstName')?.type).toBe('string');
        expect(cls!.properties.find(p => p.name === 'Age')?.type).toBe('number');
      });
    });

    // ── Generics ─────────────────────────────────────────────────────────────
    describe('Generic records', () => {
      it('parses a generic positional record', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp]
            public record PagedResult<T>(IEnumerable<T> Items, int TotalCount);
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const cls = results.flatMap(r => r.classes).find(c => c.name === 'PagedResult');
        expect(cls).toBeDefined();
        expect(cls!.genericParameters).toEqual(['T']);
        expect(cls!.properties.find(p => p.name === 'Items')?.isArray).toBe(true);
        expect(cls!.properties.find(p => p.name === 'TotalCount')?.type).toBe('number');
      });
    });

    // ── Inheritance ──────────────────────────────────────────────────────────
    describe('Record inheritance', () => {
      it('preserves base record in extends clause', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp]
            public record BaseEvent(Guid Id, DateTime OccurredAt);

            [TypeSharp]
            public record UserCreatedEvent(Guid Id, DateTime OccurredAt, string Email) : BaseEvent(Id, OccurredAt);
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const child = results.flatMap(r => r.classes).find(c => c.name === 'UserCreatedEvent');
        expect(child).toBeDefined();
        expect(child!.inheritsFrom).toBe('BaseEvent');
      });

      it('ignores C# interfaces in record inheritance', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp]
            public record MyRecord(int Id) : IEquatable<MyRecord>;
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const cls = results.flatMap(r => r.classes).find(c => c.name === 'MyRecord');
        expect(cls).toBeDefined();
        expect(cls!.inheritsFrom).toBeUndefined();
      });
    });

    // ── Per-parameter attribute overrides ────────────────────────────────────
    describe('Record parameter attribute overrides', () => {
      it('[TypeIgnore] excludes a positional parameter', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp]
            public record SecureRecord(string Name, [property: TypeIgnore] string Secret);
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const cls = results.flatMap(r => r.classes).find(c => c.name === 'SecureRecord');
        expect(cls!.properties.find(p => p.name === 'Secret')).toBeUndefined();
        expect(cls!.properties.find(p => p.name === 'Name')).toBeDefined();
      });

      it('[property: TypeAs] overrides the inferred type on a positional parameter', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp]
            public record TimestampRecord([property: TypeAs("Date")] DateTime CreatedAt);
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const cls = results.flatMap(r => r.classes).find(c => c.name === 'TimestampRecord');
        expect(cls!.properties.find(p => p.name === 'CreatedAt')?.type).toBe('Date');
      });

      it('[property: Obsolete] marks a positional parameter as deprecated', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp]
            public record LegacyRecord([property: Obsolete("Use NewId")] string OldId, string NewId);
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const cls = results.flatMap(r => r.classes).find(c => c.name === 'LegacyRecord');
        const oldId = cls!.properties.find(p => p.name === 'OldId');
        expect(oldId?.isDeprecated).toBe(true);
        expect(oldId?.deprecationMessage).toBe('Use NewId');
        expect(cls!.properties.find(p => p.name === 'NewId')?.isDeprecated).toBe(false);
      });
    });

    // ── [TypeSharp("name")] on records ───────────────────────────────────────
    describe('[TypeSharp("name")] on records', () => {
      it('overrides record name', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp("point_dto")]
            public record Point(int X, int Y);
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const cls = results.flatMap(r => r.classes).find(c => c.name === 'point_dto');
        expect(cls).toBeDefined();
        expect(cls!.isRecord).toBe(true);
        expect(results.flatMap(r => r.classes).find(c => c.name === 'Point')).toBeUndefined();
      });
    });

    // ── isRecord flag ────────────────────────────────────────────────────────
    describe('isRecord flag', () => {
      it('is true for records, false for classes', async () => {
        const { csproj } = makeTempProject(`
          namespace Test {
            [TypeSharp]
            public record MyRecord(int Id);

            [TypeSharp]
            public class MyClass { public int Id { get; set; } }
          }
        `);

        const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
        const classes = results.flatMap(r => r.classes);
        expect(classes.find(c => c.name === 'MyRecord')?.isRecord).toBe(true);
        expect(classes.find(c => c.name === 'MyClass')?.isRecord).toBe(false);
      });
    });
  });
});


describe('init-only properties', () => {
  it('parses init-only properties as normal properties', async () => {
    const { csproj } = makeTempProject(`
      namespace Test {
        [TypeSharp]
        public class LoginCommand {
          public string Email { get; init; } = default!;
          public string Password { get; init; } = default!;
          public bool RememberMe { get; init; } = false;
        }
      }
    `);

    const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
    const cls = results.flatMap(r => r.classes).find(c => c.name === 'LoginCommand');
    expect(cls).toBeDefined();
    expect(cls!.properties.find(p => p.name === 'Email')).toBeDefined();
    expect(cls!.properties.find(p => p.name === 'Password')).toBeDefined();
    expect(cls!.properties.find(p => p.name === 'RememberMe')).toBeDefined();
  });

  it('maps init-only property types correctly', async () => {
    const { csproj } = makeTempProject(`
      namespace Test {
        [TypeSharp]
        public class LoginCommand {
          public string Email { get; init; } = default!;
          public string Password { get; init; } = default!;
          public bool RememberMe { get; init; } = false;
        }
      }
    `);

    const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
    const cls = results.flatMap(r => r.classes).find(c => c.name === 'LoginCommand');
    expect(cls!.properties.find(p => p.name === 'Email')?.type).toBe('string');
    expect(cls!.properties.find(p => p.name === 'Password')?.type).toBe('string');
    expect(cls!.properties.find(p => p.name === 'RememberMe')?.type).toBe('boolean');
  });

  it('respects nullability on init-only properties', async () => {
    const { csproj } = makeTempProject(`
      namespace Test {
        [TypeSharp]
        public class ProfileCommand {
          public string Username { get; init; } = default!;
          public string? Bio { get; init; }
        }
      }
    `);

    const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
    const cls = results.flatMap(r => r.classes).find(c => c.name === 'ProfileCommand');
    expect(cls!.properties.find(p => p.name === 'Username')?.isNullable).toBe(false);
    expect(cls!.properties.find(p => p.name === 'Bio')?.isNullable).toBe(true);
  });

  it('[TypeIgnore] excludes an init-only property', async () => {
    const { csproj } = makeTempProject(`
      namespace Test {
        [TypeSharp]
        public class LoginCommand {
          public string Email { get; init; } = default!;
          [TypeIgnore]
          public string Password { get; init; } = default!;
        }
      }
    `);

    const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
    const cls = results.flatMap(r => r.classes).find(c => c.name === 'LoginCommand');
    expect(cls!.properties.find(p => p.name === 'Password')).toBeUndefined();
    expect(cls!.properties.find(p => p.name === 'Email')).toBeDefined();
  });

  it('[TypeAs] overrides type on an init-only property', async () => {
    const { csproj } = makeTempProject(`
      namespace Test {
        [TypeSharp]
        public class EventCommand {
          [TypeAs("Date")]
          public DateTime ScheduledAt { get; init; }
        }
      }
    `);

    const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
    const cls = results.flatMap(r => r.classes).find(c => c.name === 'EventCommand');
    expect(cls!.properties.find(p => p.name === 'ScheduledAt')?.type).toBe('Date');
  });

  it('[Obsolete] marks an init-only property as deprecated', async () => {
    const { csproj } = makeTempProject(`
      using System;
      namespace Test {
        [TypeSharp]
        public class LoginCommand {
          [Obsolete("Use Email instead.")]
          public string Username { get; init; } = default!;
          public string Email { get; init; } = default!;
        }
      }
    `);

    const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
    const cls = results.flatMap(r => r.classes).find(c => c.name === 'LoginCommand');
    const username = cls!.properties.find(p => p.name === 'Username');
    expect(username?.isDeprecated).toBe(true);
    expect(username?.deprecationMessage).toBe('Use Email instead.');
    expect(cls!.properties.find(p => p.name === 'Email')?.isDeprecated).toBe(false);
  });

  it('ignores the generic interface base (ICommand<T>) — no inheritsFrom set', async () => {
    const { csproj } = makeTempProject(`
      namespace Test {
        [TypeSharp]
        public class LoginCommand : ICommand<string> {
          public string Email { get; init; } = default!;
        }
      }
    `);

    const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
    const cls = results.flatMap(r => r.classes).find(c => c.name === 'LoginCommand');
    expect(cls).toBeDefined();
    expect(cls!.inheritsFrom).toBeUndefined();
  });
});


describe('[Union] enum support', () => {
  it('sets isUnion: true when [TypeSharp][Union] decorates an enum', async () => {
    const { csproj } = makeTempProject(`
      namespace Test {
        [TypeSharp]
        [Union]
        public enum Status { Active, Inactive }
      }
    `);

    const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
    const cls = results.flatMap(r => r.classes).find(c => c.name === 'Status');
    expect(cls).toBeDefined();
    expect(cls!.isEnum).toBe(true);
    expect(cls!.isUnion).toBe(true);
  });

  it('sets isUnion: true when [Union] comes before [TypeSharp]', async () => {
    const { csproj } = makeTempProject(`
      namespace Test {
        [Union]
        [TypeSharp]
        public enum Status { Active, Inactive }
      }
    `);

    const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
    const cls = results.flatMap(r => r.classes).find(c => c.name === 'Status');
    expect(cls).toBeDefined();
    expect(cls!.isUnion).toBe(true);
  });

  it('sets isUnion: true when [TypeSharp][Union] are on the same line', async () => {
    const { csproj } = makeTempProject(`
      namespace Test {
        [TypeSharp][Union]
        public enum Direction { North, South, East, West }
      }
    `);

    const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
    const cls = results.flatMap(r => r.classes).find(c => c.name === 'Direction');
    expect(cls?.isUnion).toBe(true);
  });

  it('does NOT set isUnion on a plain [TypeSharp] enum', async () => {
    const { csproj } = makeTempProject(`
      namespace Test {
        [TypeSharp]
        public enum UserRoleCode { Admin, User, Guest }
      }
    `);

    const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
    const cls = results.flatMap(r => r.classes).find(c => c.name === 'UserRoleCode');
    expect(cls).toBeDefined();
    expect(cls!.isUnion).toBeFalsy();
  });

  it('ignores [Union] without [TypeSharp]', async () => {
    const { csproj } = makeTempProject(`
      namespace Test {
        [Union]
        public enum Ignored { A, B }
      }
    `);

    const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
    const cls = results.flatMap(r => r.classes).find(c => c.name === 'Ignored');
    expect(cls).toBeUndefined();
  });

  it('works with [TypeSharp("name")] name override', async () => {
    const { csproj } = makeTempProject(`
      namespace Test {
        [TypeSharp("status_type")]
        [Union]
        public enum Status { Active, Inactive }
      }
    `);

    const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
    const cls = results.flatMap(r => r.classes).find(c => c.name === 'status_type');
    expect(cls).toBeDefined();
    expect(cls!.isUnion).toBe(true);
    expect(results.flatMap(r => r.classes).find(c => c.name === 'Status')).toBeUndefined();
  });

  it('preserves all enum values in a union enum', async () => {
    const { csproj } = makeTempProject(`
      namespace Test {
        [TypeSharp]
        [Union]
        public enum OrderStatus { Pending, Processing, Shipped, Delivered, Cancelled }
      }
    `);

    const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
    const cls = results.flatMap(r => r.classes).find(c => c.name === 'OrderStatus');
    expect(cls!.enumValues).toEqual(['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled']);
  });

  it('sets isUnion: true with [TypeSharp, Union] comma syntax', async () => {
    const { csproj } = makeTempProject(`
      namespace Test {
        [TypeSharp, Union]
        public enum Status { Active, Inactive }
      }
    `);

    const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
    const cls = results.flatMap(r => r.classes).find(c => c.name === 'Status');
    expect(cls).toBeDefined();
    expect(cls!.isUnion).toBe(true);
  });

  it('sets isUnion: true with [TypeSharp("name"), Union] comma syntax', async () => {
    const { csproj } = makeTempProject(`
      namespace Test {
        [TypeSharp("my_status"), Union]
        public enum Status { Active, Inactive }
      }
    `);

    const results = await parseCSharpFiles({ source: csproj, outputPath: '/tmp/out' });
    const cls = results.flatMap(r => r.classes).find(c => c.name === 'my_status');
    expect(cls).toBeDefined();
    expect(cls!.isUnion).toBe(true);
  });
});


// Cleanup any leftover temp projects after tests run
afterAll(() => {
  const tmpDir = os.tmpdir();
  const entries = fs.readdirSync(tmpDir);
  for (const entry of entries) {
    if (entry.startsWith('ts-parser-')) {
      fs.rmSync(path.join(tmpDir, entry), { recursive: true, force: true });
    }
  }
});