<p align="center">
  <img src="https://raw.githubusercontent.com/siyavuyachagi/typesharp/main/public/BannerTransparent.svg" alt="TypeSharp" height="120" />
</p>

<p align='center'>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/@siyavuyachagi/typesharp.svg?label=Version)](https://www.npmjs.com/package/@siyavuyachagi/typesharp)
[![npm downloads](https://img.shields.io/npm/dm/@siyavuyachagi/typesharp.svg?label=Downloads)](https://www.npmjs.com/package/@siyavuyachagi/typesharp)
[![GitHub commits](https://img.shields.io/github/commit-activity/m/siyavuyachagi/typesharp?label=Commits)](https://github.com/siyavuyachagi/typesharp/commits/main)
[![GitHub last commit](https://img.shields.io/github/last-commit/siyavuyachagi/typesharp?label=Last+commit)](https://github.com/siyavuyachagi/typesharp/commits/main)
[![GitHub stars](https://img.shields.io/github/stars/siyavuyachagi/typesharp?label=Stars)](https://github.com/siyavuyachagi/typesharp/stargazers)
[![Sponsor](https://img.shields.io/badge/Sponsor-💖-ff69b4)](https://github.com/sponsors/siyavuyachagi)

</p>

Generate TypeScript types from C# models with ease! TypeSharp scans your ASP.NET Core projects and automatically generates TypeScript interfaces from your C# classes and records decorated with the `[TypeSharp]` attribute.

Project structure: [docs/project-structure](docs/project-structure.md)

## Features

- **Automatic Type Generation** – Convert C# models to TypeScript interfaces
- **Record Support** – Positional records, `record class`, `record struct`, and body-only records
- **Custom Attribute Targeting** – Use `[TypeSharp]` or any custom attribute
- **Nullable Support** – `string?` → `string | null`
- **Collection Handling** – Supports `List<T>`, `IEnumerable<T>`, arrays **and generic collections**
- **Dictionary Mapping** – `Dictionary<K, V>` → `Record<K, V>`
- **Generic Types** – Preserves generic type definitions like `Response<T>` → `Response<T>`
- **Inheritance** – Preserves class and record inheritance using `extends`
- **Computed Properties** – Expression-bodied and block getter properties are included
- **Naming Conventions** – Convert property names (camel, pascal, snake, kebab)
- **Flexible Output** – Single file or multiple files
- **Enum Support** – Converts C# enums to TypeScript string enums
- **File Grouping** – Preserves C# file organization (multiple classes per file stay together)
- **Auto Imports** – Automatically generates `import type` statements between output files
- **Multi-Project** – Scan multiple `.csproj` files in a single run
- **Obsolete Support** – `[Obsolete]` / `[Obsolete("...")]` → `/** @deprecated ... */` JSDoc

## How TypeSharp Compares

This is not an OpenApi-based tool !
| Feature | TypeSharp | NSwag | openapi-typescript | TypeGen |
| --------------------- | --------- | ----- | ------------------ | ------- |
| Direct C# parsing | ✓ | ✕ | ✕ | ✓ |
| Attribute targeting | ✓ | ! | ✕ | ! |
| Non-API models | ✓ | ✕ | ✕ | ✓ |
| Generics preserved | ✓ | ! | ! | ! |
| Record support | ✓ | ✕ | ✕ | ✕ |
| File grouping | ✓ | ✕ | ✕ | ✕ |
| Naming control | ✓ | ! | ! | ✕ |
| API client generation | ✕ | ✓ | ✕ | ✕ |

Also see [docs/why-typesharp](docs/why-typesharp.md)

## Installation

```bash
npm install -D @siyavuyachagi/typesharp
```

## Quick Start

### 1. Install the NuGet attributes package

In your C# project:

```bash
dotnet add package TypeSharp.Attributes
```

### 2. Decorate your C# models or DTOs

Use `[TypeSharp]` on classes, records, or enums:

```csharp
[TypeSharp]
public class User
{
  public int Id { get; set; }
  public string? Name { get; set; }
  public string Email { get; set; }
  public List<UserRole> Roles { get; set; }
  public List<string> Permissions { get; set; }
  public DateTime CreatedAt { get; set; }
}

[TypeSharp]
public record ProductSummary(int Id, string Name, decimal Price);

[TypeSharp]
public enum UserRole
{
  Admin,
  User,
  Guest
}

[TypeSharp]
public class ApiResponse<T>
{
  public bool Success { get; set; }
  public string? Message { get; set; }
  public T Data { get; set; }
  public List<string> Errors { get; set; }
}
```

### 3. Create a configuration file

In your frontend project run the following script

```bash
# Create TypeScript config
npx typesharp init

# ----- OR -------

# Create JSON config
npx typesharp init --format json

# Create TypeScript config (default)
npx typesharp init --format ts

# Create JavaScript config
npx typesharp init --format js
```

This creates `typesharp.config.json`:

```json
{
  "source": [
    "C:/Users/User/Desktop/MyApp/Api/Api.csproj",
    "C:/Users/User/Desktop/MyApp/Domain/Domain.csproj"
  ],
  "outputPath": "./app/types",
  "singleOutputFile": false,
  "namingConvention": "camel"
}
```

### 4. Generate TypeScript types

```bash
npx typesharp
# OR
npx typesharp generate

# ----- With options -------

# custom config
npx typesharp generate --config ./custom-config.ts
# force clean generation
npx typesharp generate --no-incremental
```

For more advanced usage [docs/usage](docs/usage.md)

## Configuration

### 1. Configuration Options

| Option             | Type                                      | Default    | Description                                                   |
| ------------------ | ----------------------------------------- | ---------- | ------------------------------------------------------------- |
| `source`           | `string \| string[]`                      | _required_ | Full path(s) to your C# .csproj file(s)                       |
| `outputPath`       | `string`                                  | _required_ | Where to generate TypeScript files                            |
| `singleOutputFile` | `boolean`                                 | `false`    | Generate one file or multiple files (see below)               |
| `namingConvention` | `string \| { dir: string, file: string }` | `'camel'`  | Property/file/dir naming: `kebab`, `camel`, `pascal`, `snake` |
| `fileSuffix`       | `string`                                  | _optional_ | Suffix appended to generated file names: `user-dto.ts`        |

### 2. Naming Convention

`namingConvention` accepts either a simple string that applies to everything, or a config object for separate control over directories and files:

```json
// Simple — applies to both dirs and files
{ "namingConvention": "kebab" }

// Advanced — separate control
{
  "namingConvention": {
    "dir": "kebab",
    "file": "camel"
  }
}
```

### 3. Output File Behavior

TypeSharp preserves your C# file organization. Here's how it works:

| C# File Structure                                          | `singleOutputFile: false`                        | `singleOutputFile: true`  |
| ---------------------------------------------------------- | ------------------------------------------------ | ------------------------- |
| **One class per file**<br>`User.cs` → 1 class              | `user.ts` (1 interface)                          | All classes in `types.ts` |
| **Multiple classes per file**<br>`UserDtos.cs` → 3 classes | `user-dtos.ts` (3 interfaces)                    | All classes in `types.ts` |
| **Mixed structure**<br>Various C# files                    | Each C# file → 1 TS file<br>(preserves grouping) | All classes in `types.ts` |

### 4. Configuration File Formats

TypeSharp supports multiple configuration formats:

**JSON** (`typesharp.config.json`): ⭐ **recommended**

```json
{
  "source": ["C:/Users/User/Desktop/MyApp/Domain/Domain.csproj"],
  "outputPath": "./src/types"
}
```

**JavaScript** (`typesharp.config.js`):

```javascript
const config = {
  source: ['C:/Users/User/Desktop/MyApp/Domain/Domain.csproj'],
  outputPath: './src/types',
};

export default config;
```

**TypeScript** (`typesharp.config.ts`): ⚠️ **requires special setup**

TypeScript config files require one of the following approaches:

1. Convert to JavaScript first (recommended):

   ```bash
   tsc typesharp.config.ts --module nodenext
   ```

2. Run with tsx loader:

   ```bash
   node --loader tsx/cjs ./node_modules/@siyavuyachagi/typesharp/bin/typesharp.js
   ```

3. Or use a `.js` config file instead (simplest)

If you prefer TypeScript configs, JSON format is the easiest alternative that provides type safety through JSDoc in most editors.

## Usage in package.json

Add TypeSharp to your build scripts:

```json
{
  "scripts": {
    "generate-types": "typesharp",
    "dev": "typesharp && nuxt dev",
    "build": "typesharp && nuxt build"
  }
}
```

## Advanced Examples

### 1. Records

TypeSharp supports all C# record forms. Records are emitted as TypeScript interfaces identical to classes.

**Positional record:**

```csharp
[TypeSharp]
public record ProductSummary(int Id, string Name, decimal Price, bool IsActive);
```

```typescript
export interface ProductSummary {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
}
```

**Positional record with nullable and collection parameters:**

```csharp
[TypeSharp]
public record UserRecord(int Id, string? DisplayName, List<string> Tags);
```

```typescript
export interface UserRecord {
  id: number;
  displayName: string | null;
  tags: string[];
}
```

**Generic positional record:**

```csharp
[TypeSharp]
public record PagedResult<T>(IEnumerable<T> Items, int TotalCount, int PageSize);
```

```typescript
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageSize: number;
}
```

**`record class` and `record struct`:**

```csharp
[TypeSharp]
public record class AddressRecord(string Street, string City, string PostalCode);

[TypeSharp]
public record struct CoordRecord(double Lat, double Lng);
```

**Body-only record (no primary constructor):**

```csharp
[TypeSharp]
public record PersonRecord
{
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public int Age { get; set; }
}
```

**Record inheritance:**

```csharp
[TypeSharp]
public record BaseEvent(Guid Id, DateTime OccurredAt);

[TypeSharp]
public record UserCreatedEvent(Guid Id, DateTime OccurredAt, string Email) : BaseEvent(Id, OccurredAt);
```

```typescript
export interface BaseEvent {
  id: string;
  occurredAt: string;
}

export interface UserCreatedEvent extends BaseEvent {
  id: string;
  occurredAt: string;
  email: string;
}
```

**Per-parameter attribute overrides** (use the `property:` target — required by C# for primary constructor parameters):

```csharp
[TypeSharp]
public record SecureRecord(
    string Name,
    [property: TypeIgnore] string Secret,
    [property: TypeAs("Date")] DateTime CreatedAt,
    [property: Obsolete("Use Name")] string LegacyName
);
```

```typescript
export interface SecureRecord {
  name: string;
  /** @deprecated Use Name */
  legacyName: string;
  createdAt: Date;
}
```

> `[TypeIgnore]`, `[TypeName("x")]`, `[TypeAs("y")]`, and `[Obsolete]` on primary constructor parameters require the `property:` attribute target because C# must know the attribute applies to the generated property, not the constructor parameter itself.

### 2. With Inheritance

**C#:**

```csharp
[TypeSharp]
public class BaseEntity
{
    public int Id { get; set; }
    public DateTime CreatedAt { get; set; }
}

[TypeSharp]
public class Product : BaseEntity
{
    public string Name { get; set; }
    public decimal Price { get; set; }
}
```

**Generated TypeScript:**

```typescript
export interface BaseEntity {
  id: number;
  createdAt: string;
}

export interface Product extends BaseEntity {
  name: string;
  price: number;
}
```

### 3. Computed Properties

TypeSharp includes expression-bodied and block getter properties:

**C#:**

```csharp
[TypeSharp]
public class PollOptionUserLinkDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public UserDto User { get; set; }

    // Expression-bodied
    public string? Avatar => User?.Avatar;

    // Block getter
    public string UserFirstName { get { return User.FirstName; } }
}
```

**Generated TypeScript:**

```typescript
export interface PollOptionUserLinkDto {
  id: number;
  userId: number;
  user: UserDto;
  avatar: string | null;
  userFirstName: string;
}
```

### 4. Dictionary Types

**C#:**

```csharp
[TypeSharp]
public class PermissionMap
{
    public Dictionary<string, bool> Flags { get; set; }
    public IReadOnlyDictionary<string, List<string>> RolePermissions { get; set; }
}
```

**Generated TypeScript:**

```typescript
export interface PermissionMap {
  flags: Record<string, boolean>;
  rolePermissions: Record<string, string[]>;
}
```

### 5. Obsolete / Deprecated Properties

**C#:**

```csharp
[TypeSharp]
public class Employee
{
    public int Id { get; set; }
    public string Department { get; set; }

    [Obsolete("Use Department instead.")]
    public string? DepartmentName { get; set; }

    [Obsolete]
    public string? LegacyCode { get; set; }
}
```

**Generated TypeScript:**

```typescript
export interface Employee {
  id: number;
  department: string;
  /** @deprecated Use Department instead. */
  departmentName: string | null;
  /** @deprecated */
  legacyCode: string | null;
}
```

### 6. Custom Type Name Override

```csharp
[TypeSharp("auth_response")]
public class AuthResponse
{
    public string AccessToken { get; set; }
    public string RefreshToken { get; set; }
}
```

```typescript
export interface auth_response {
  accessToken: string;
  refreshToken: string;
}
```

### 7. Multi-Project

```json
{
  "source": [
    "C:/MyApp/Api/Api.csproj",
    "C:/MyApp/Domain/Domain.csproj",
    "C:/MyApp/Contracts/Contracts.csproj"
  ],
  "outputPath": "./src/types"
}
```

### 8. Single Output File

```typescript
const config: TypeSharpConfig = {
  source: './Backend/Backend.csproj',
  outputPath: './src/types',
  singleOutputFile: true,
};
```

### 9. Custom Naming Conventions

```typescript
const config: TypeSharpConfig = {
  source: './Backend/Backend.csproj',
  outputPath: './src/types',
  namingConvention: {
    dir: 'kebab',
    file: 'camel',
  },
};
```

## Type Mappings

### Primitives & Common Types

| C# Type                                             | TypeScript Type |
| --------------------------------------------------- | --------------- |
| `bool`                                              | `boolean`       |
| `byte`, `decimal`, `double`, `float`, `int`, `long` | `number`        |
| `DateTime`, `DateOnly`, `TimeOnly`                  | `string`        |
| `Guid`, `string`                                    | `string`        |
| `object`                                            | `any`           |

### Collections

| C# Type                                                              | TypeScript Type |
| -------------------------------------------------------------------- | --------------- |
| `List<T>`, `ICollection<T>`, `IEnumerable<T>`, `T[]`                 | `T[]`           |
| `Dictionary<K, V>`, `IDictionary<K, V>`, `IReadOnlyDictionary<K, V>` | `Record<K, V>`  |

### ASP.NET / File Types

| C# Type                                | TypeScript Type |
| -------------------------------------- | --------------- |
| `IFormFile`, `FormFile`                | `File`          |
| `IFormFileCollection`                  | `File[]`        |
| `FileStream`, `MemoryStream`, `Stream` | `Blob`          |

## Programmatic Usage

```typescript
import { generate } from 'typesharp';

async function generateTypes() {
  await generate('./path/to/config.ts');
}

generateTypes();
```

## Preview

### Terminal Output

<img src="https://github.com/siyavuyachagi/typesharp/blob/main/public/images/terminal.png?raw=true" alt="TypeSharp" />

### Test Results

  <img src="./public/images/tests.png" alt="TypeSharp" />

## Requirements

- Node.js >= 20
- TypeScript >= 4.5 (if using TypeScript config)

## License

MIT © Siyavuya Chagi

## Author

**Siyavuya Chagi (CeeJay)**

- GitHub: [@siyavuyachagi](https://github.com/siyavuyachagi)
- Email: syavuya08@gmail.com

---

Built with ❤️ in South Africa 🇿🇦
