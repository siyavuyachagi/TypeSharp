# TypeSharp Usage Guide

Complete guide to using TypeSharp for generating TypeScript types from C# models and records.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [CLI Usage](#cli-usage)
- [C# Attribute Setup](#c-attribute-setup)
- [Type Mappings](#type-mappings)
- [Records](#records)
- [Generic Types Support](#generic-types-support)
- [Naming Conventions](#naming-conventions)
- [Advanced Usage](#advanced-usage)
- [Integration Examples](#integration-examples)
- [Troubleshooting](#troubleshooting)

## Installation

### Install as Dev Dependency

```bash
npm install @siyavuyachagi/typesharp --save-dev
```

### Install Globally (Optional)

```bash
npm install -g @siyavuyachagi/typesharp
```

## Quick Start

### Step 1: Decorate Your Models / Data Transfer Objects

```bash
# In your C# project
dotnet add package TypeSharp.Attributes
```

```csharp
using TypeSharp.Attributes;

[TypeSharp]
public class User
{
  public int Id { get; set; }
  public string Name { get; set; }
  public string? Email { get; set; }
  public DateTime CreatedAt { get; set; }
}
```

### Step 2: Initialize Configuration

```bash
npx typesharp init
# or (if installed globally)
typesharp init
```

This creates `typesharp.config.ts` in your project root.

> **Note:** Use `npx typesharp init` if installed as a dev dependency. Use `typesharp init` if installed globally.

### Step 3: Configure Paths

Edit `typesharp.config.ts`:

```typescript
import type { TypeSharpConfig } from '@siyavuyachagi/typesharp';

const config: TypeSharpConfig = {
  source: ['C:/Users/User/Desktop/MyApp/MyApp.sln'],
  outputPath: './src/types',
  singleOutputFile: false,
  namingConvention: 'camel',
};

export default config;
```

### Step 4: Generate Types

```bash
npx typesharp
# or
npx typesharp generate

# If installed globally:
typesharp
# or
typesharp generate
```

## Configuration

### Configuration Options

| Option             | Type                                      | Default    | Description                                                   |
| ------------------ | ----------------------------------------- | ---------- | ------------------------------------------------------------- |
| `source`           | `string \| string[]`                      | _required_ | Path(s) to `.csproj`, `.sln`, or `.slnx` file(s)              |
| `outputPath`       | `string`                                  | _required_ | Where to generate TypeScript files                            |
| `singleOutputFile` | `boolean`                                 | `false`    | Generate one file or multiple files                           |
| `namingConvention` | `string \| { dir: string, file: string }` | `'camel'`  | Property/file/dir naming: `kebab`, `camel`, `pascal`, `snake` |
| `fileSuffix`       | `string`                                  | _optional_ | Suffix appended to generated file names: `user-dto.ts`        |

#### `source`

Accepts a single path or array. Supports `.csproj`, `.sln`, and `.slnx` files.

```json
{ "source": "C:/MyApp/MyApp.sln" }
```

```json
{ "source": ["C:/MyApp/Api/Api.csproj", "C:/MyApp/Domain/Domain.csproj"] }
```

#### `singleOutputFile`

- `false` (default): One TypeScript file per C# source file, preserving folder structure and class grouping
- `true`: All types in a single `types.ts` file

#### `namingConvention`

```json
{ "namingConvention": "kebab" }
```

```json
{
  "namingConvention": {
    "dir": "kebab",
    "file": "camel"
  }
}
```

Available values: `"camel"` | `"kebab"` | `"pascal"` | `"snake"`

#### `fileSuffix`

```json
{ "fileSuffix": "dto" }
```

`User.cs` → `user-dto.ts` (with `namingConvention: "kebab"`)

### Configuration File Formats

#### JSON — `typesharp.config.json`

```json
{
  "source": ["C:/Users/User/Desktop/MyApp/MyApp.sln"],
  "outputPath": "./src/types",
  "singleOutputFile": false,
  "namingConvention": "camel"
}
```

#### TypeScript — `typesharp.config.ts` (Recommended)

```typescript
import type { TypeSharpConfig } from '@siyavuyachagi/typesharp';

const config: TypeSharpConfig = {
  source: ['C:/Users/User/Desktop/MyApp/MyApp.sln'],
  outputPath: './src/types',
  singleOutputFile: false,
  namingConvention: 'camel',
};

export default config;
```

#### JavaScript — `typesharp.config.js`

```javascript
module.exports = {
  source: ['C:/Users/User/Desktop/MyApp/MyApp.sln'],
  outputPath: './src/types',
  singleOutputFile: false,
  namingConvention: 'camel',
};
```

### Custom Config Path

```bash
npx typesharp generate --config ./configs/my-config.json
```

## CLI Usage

### Commands

#### Generate (Default)

**Local installation (dev dependency):**

```bash
npx typesharp
npx typesharp generate
npx typesharp generate --config ./my-config.json
```

**Global installation:**

```bash
typesharp
typesharp generate
typesharp generate --config ./my-config.json
```

#### Init

**Local installation (dev dependency):**

```bash
# TypeScript config (default)
npx typesharp init

# JSON config
npx typesharp init --format json

# JavaScript config
npx typesharp init --format js
```

**Global installation:**

```bash
# TypeScript config (default)
typesharp init

# JSON config
typesharp init --format json

# JavaScript config
typesharp init --format js
```

#### Help & Version

```bash
npx typesharp --help / -h
npx typesharp --version / -V
```

## C# Attribute Setup

### On Classes

```csharp
[TypeSharp]
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; }
    public decimal Price { get; set; }
}
```

### On Records

```csharp
[TypeSharp]
public record ProductSummary(int Id, string Name, decimal Price);
```

### On Enums

```csharp
[TypeSharp]
public enum OrderStatus
{
    Pending,
    Processing,
    Shipped,
    Delivered,
    Cancelled
}
```

```typescript
export enum OrderStatus {
  Pending = 'Pending',
  Processing = 'Processing',
  Shipped = 'Shipped',
  Delivered = 'Delivered',
  Cancelled = 'Cancelled',
}
```

### Union Enums with `[Union]`

For stricter type safety and discriminated unions, use `[Union]` alongside `[TypeSharp]` on enums. This generates a const object with `as const` and a derived union type instead of a standard enum:

```csharp
[TypeSharp]
[Union]
public enum OrderStatus
{
    Pending,
    Processing,
    Shipped,
    Delivered,
    Cancelled
}
```

```typescript
export const OrderStatus = {
  Pending: 'Pending',
  Processing: 'Processing',
  Shipped: 'Shipped',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
```

The `[Union]` and `[TypeSharp]` attributes can be combined in multiple ways:

```csharp
// Stacked attributes
[TypeSharp]
[Union]
public enum Status { ... }

// Reverse order
[Union]
[TypeSharp]
public enum Status { ... }

// Single bracket with comma
[TypeSharp, Union]
public enum Status { ... }

// With name override
[TypeSharp("status_type"), Union]
public enum Status { ... }
```

### Custom Type Name Override

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

### Property Attribute Overrides

**`[TypeIgnore]`** — excludes the property from the generated output:

```csharp
[TypeSharp]
public class UserDto
{
    public string Name { get; set; }
    [TypeIgnore]
    public string PasswordHash { get; set; }
}
```

**`[TypeName("name")]`** — overrides the generated property name:

```csharp
[TypeSharp]
public class UserDto
{
    [TypeName("created_at")]
    public DateTime CreatedAt { get; set; }
}
```

**`[TypeAs("type")]`** — overrides the inferred TypeScript type:

```csharp
[TypeSharp]
public class UserDto
{
    [TypeAs("Date")]
    public DateTime UpdatedAt { get; set; }
}
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
| `List<T>`, `ICollection<T>`, `IEnumerable<T>`, `IList<T>`, `T[]`     | `T[]`           |
| `Dictionary<K, V>`, `IDictionary<K, V>`, `IReadOnlyDictionary<K, V>` | `Record<K, V>`  |

### ASP.NET / File Types

| C# Type                                | TypeScript Type |
| -------------------------------------- | --------------- |
| `IFormFile`, `FormFile`                | `File`          |
| `IFormFileCollection`                  | `File[]`        |
| `FileStream`, `MemoryStream`, `Stream` | `Blob`          |

### Nullable Types

```csharp
[TypeSharp]
public class User {
  public string? Name { get; set; }
  public int? Age { get; set; }
  public DateOnly? DateOfBirth { get; set; }
}
```

```typescript
export interface User {
  name: string | null;
  age: number | null;
  dateOfBirth: string | null;
}
```

### Enum Generation Modes

TypeSharp supports two ways to generate TypeScript from C# enums:

| Feature              | Standard `[TypeSharp]`                          | With `[Union]`                                              |
| -------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| C# Syntax            | `[TypeSharp] public enum Status { ... }`        | `[TypeSharp][Union] public enum Status { ... }`             |
| TypeScript Output    | `export enum Status { Active = 'Active', ... }` | `export const Status = { Active: 'Active', ... } as const;` |
| TypeScript Type      | enum type                                       | `type Status = 'Active' \| 'Inactive'` (union)              |
| Value Access         | `Status.Active`                                 | `Status.Active`                                             |
| Type Guard           | Manual checking                                 | Can use `Object.values(Status)`                             |
| Discriminated Unions | Less ideal                                      | Ideal                                                       |
| Tree-shakeable       | Depends on bundler                              | ✅ Yes                                                      |

Use **`[Union]`** when you need stricter type safety or discriminated union patterns. Use standard **`[TypeSharp]`** for simple enum value grouping.

## Records

TypeSharp supports all C# record forms. Records are emitted as TypeScript interfaces, identical to classes.

### Positional Records

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

Nullable and collection parameters are fully supported:

```csharp
[TypeSharp]
public record UserRecord(int Id, string? DisplayName, DateOnly? DateOfBirth, List<string> Tags);
```

```typescript
export interface UserRecord {
  id: number;
  displayName: string | null;
  dateOfBirth: string | null;
  tags: string[];
}
```

### `record class` and `record struct`

Both explicit record keywords are supported:

```csharp
[TypeSharp]
public record class AddressRecord(string Street, string City, string PostalCode);

[TypeSharp]
public record struct CoordRecord(double Lat, double Lng);
```

### Body-Only Records

Records without a primary constructor are parsed the same way as classes:

```csharp
[TypeSharp]
public record PersonRecord
{
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public int Age { get; set; }
}
```

```typescript
export interface PersonRecord {
  firstName: string;
  lastName: string;
  age: number;
}
```

### Generic Records

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

### Record Inheritance

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

C# interfaces in the inheritance chain are automatically filtered out, the same as for classes:

```csharp
[TypeSharp]
public record MyRecord(int Id) : IEquatable<MyRecord>; // IEquatable is ignored
```

### Per-Parameter Attribute Overrides

`[TypeIgnore]`, `[TypeName]`, `[TypeAs]`, and `[Obsolete]` are supported on primary constructor parameters. C# requires the `property:` attribute target so the compiler knows the attribute applies to the generated property, not the constructor parameter itself.

```csharp
[TypeSharp]
public record SecureRecord(
    string Name,
    [property: TypeIgnore] string Secret,
    [property: TypeAs("Date")] DateTime CreatedAt,
    [property: Obsolete("Use Name instead")] string LegacyAlias
);
```

```typescript
export interface SecureRecord {
  name: string;
  /** @deprecated Use Name instead */
  legacyAlias: string;
  createdAt: Date;
}
```

> Note: `[Obsolete]` targets all by default in C# so it also works without the `property:` prefix — `[property: Obsolete("...")]` and `[Obsolete("...")]` are both accepted.

### `[TypeSharp("name")]` on Records

```csharp
[TypeSharp("point_dto")]
public record Point(int X, int Y);
```

```typescript
export interface point_dto {
  x: number;
  y: number;
}
```

## Generic Types Support

### Single Generic Parameter

```csharp
[TypeSharp]
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public T? Data { get; set; }
    public List<string> Errors { get; set; }
}
```

```typescript
export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T | null;
  errors: string[];
}
```

### Multiple Generic Parameters

```csharp
[TypeSharp]
public class Result<TData, TError>
{
    public bool IsSuccess { get; set; }
    public TData? Data { get; set; }
    public TError? Error { get; set; }
}
```

```typescript
export interface Result<TData, TError> {
  isSuccess: boolean;
  data: TData | null;
  error: TError | null;
}
```

### Generic Inheritance

```csharp
[TypeSharp]
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public T? Data { get; set; }
}

[TypeSharp]
public class PagedApiResponse<T> : ApiResponse<T>
{
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
    public int TotalRecords { get; set; }
}
```

```typescript
export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T | null;
}

export interface PagedApiResponse<T> extends ApiResponse<T> {
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
}
```

## Naming Conventions

### Simple Convention

```json
{ "namingConvention": "kebab" }
```

### Advanced Convention

```json
{
  "namingConvention": {
    "dir": "kebab",
    "file": "camel"
  }
}
```

### Available Options

| Convention | Directory example | File example      |
| ---------- | ----------------- | ----------------- |
| `camel`    | `myFeature/`      | `userProfile.ts`  |
| `kebab`    | `my-feature/`     | `user-profile.ts` |
| `pascal`   | `MyFeature/`      | `UserProfile.ts`  |
| `snake`    | `my_feature/`     | `user_profile.ts` |

> Property names always use camelCase regardless of the `namingConvention` setting.

## Advanced Usage

### Union Enums (const + type)

When you want stricter type safety and better discriminated union support, use `[Union]` to generate a const object with a union type instead of a standard TypeScript enum:

**Why use union enums?**

- **Type-safe object keys**: Access values via the const object (e.g., `OrderStatus.Pending`)
- **Better union types**: The resulting type is a literal union, not an enum type
- **Discriminated unions**: Pairs well with discriminated union patterns in TypeScript
- **Tree-shakeable**: Const objects are easier for bundlers to tree-shake than enums

**Example:**

```csharp
[TypeSharp]
[Union]
public enum OrderStatus
{
    Pending,
    Processing,
    Shipped,
    Delivered,
    Cancelled
}
```

Generates:

```typescript
export const OrderStatus = {
  Pending: 'Pending',
  Processing: 'Processing',
  Shipped: 'Shipped',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
```

Usage in TypeScript:

```typescript
// Use as const object for values
function updateOrder(status: OrderStatus): void {
  const nextStatus = OrderStatus.Shipped; // ✅ type-safe
}

// Use in union type constraints
type OrderAction =
  | { type: 'confirm'; status: OrderStatus; timestamp: string }
  | { type: 'cancel'; reason: string };

// Type guard
function isValidStatus(value: string): value is OrderStatus {
  return Object.values(OrderStatus).includes(value as OrderStatus);
}
```

### Inheritance

TypeSharp preserves class and record inheritance using `extends`:

```csharp
[TypeSharp]
public class Entity
{
    public int Id { get; set; }
}

[TypeSharp]
public class AuditableEntity : Entity
{
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

[TypeSharp]
public class User : AuditableEntity
{
    public string Name { get; set; }
    public string Email { get; set; }
}
```

```typescript
export interface Entity {
  id: number;
}

export interface AuditableEntity extends Entity {
  createdAt: string;
  updatedAt: string;
}

export interface User extends AuditableEntity {
  name: string;
  email: string;
}
```

### C# Interface Inheritance

TypeSharp automatically filters out C# interfaces from the inheritance chain for both classes and records. Any base type matching the standard C# interface naming convention (`I` followed by an uppercase letter) is ignored.

```csharp
[TypeSharp]
public class PaymentResult : BaseResult, IActionResult, IDisposable
{
    public bool Paid { get; set; }
}
```

```typescript
export interface PaymentResult extends BaseResult {
  paid: boolean;
}
```

### Computed Properties

TypeSharp includes expression-bodied and block getter properties:

```csharp
[TypeSharp]
public class UserDto
{
    public string FirstName { get; set; }
    public string LastName { get; set; }

    // Expression-bodied
    public string FullName => $"{FirstName} {LastName}";

    // Block getter
    public string Initials { get { return $"{FirstName[0]}{LastName[0]}"; } }
}
```

```typescript
export interface UserDto {
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
}
```

### Obsolete / Deprecated Properties

```csharp
[TypeSharp]
public class UserDto
{
    public string Email { get; set; }

    [Obsolete("Use Email instead.")]
    public string? Username { get; set; }

    [Obsolete]
    public string? LegacyId { get; set; }
}
```

```typescript
export interface UserDto {
  email: string;
  /** @deprecated Use Email instead. */
  username: string | null;
  /** @deprecated */
  legacyId: string | null;
}
```

> Supported on `{ get; set; }`, expression-bodied (`=>`), block getter properties, and record primary constructor parameters (with `[property: Obsolete]`).

### Multi-Project

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

Or using a solution file:

```json
{
  "source": "C:/MyApp/MyApp.sln",
  "outputPath": "./src/types"
}
```

### Single Output File

```json
{
  "source": "./Backend/Backend.csproj",
  "outputPath": "./src/types",
  "singleOutputFile": true
}
```

All types are written to `src/types/types.ts`.

### Programmatic Usage

```typescript
import { generate } from '@siyavuyachagi/typesharp';

await generate(); // uses default config
await generate('./custom-config.json'); // custom config path
```

### Advanced Programmatic Usage

```typescript
import { parseCSharpFiles, generateTypeScriptFiles } from '@siyavuyachagi/typesharp';
import type { TypeSharpConfig } from '@siyavuyachagi/typesharp';

const config: TypeSharpConfig = {
  source: ['C:/Users/User/Desktop/MyApp/Api/Api.csproj'],
  outputPath: './src/types',
};

const parseResults = await parseCSharpFiles(config);
generateTypeScriptFiles(config, parseResults);
```

## Integration Examples

### Vue 3 + Nuxt 3 + ASP.NET Core

**`typesharp.config.ts`:**

```typescript
import type { TypeSharpConfig } from '@siyavuyachagi/typesharp';

const config: TypeSharpConfig = {
  source: '../MyApp/MyApp.sln',
  outputPath: './src/types',
  singleOutputFile: false,
  namingConvention: 'camel',
};

export default config;
```

**`package.json`:**

```json
{
  "scripts": {
    "predev": "typesharp",
    "prebuild": "typesharp",
    "dev": "nuxt dev",
    "build": "nuxt build"
  }
}
```

**Usage in Vue:**

```vue
<script setup lang="ts">
import type { User } from '~/types/user';
import type { ApiResponse } from '~/types/apiResponse';
import type { ProductSummary } from '~/types/productSummary';

const fetchUser = async (id: number) => {
  const response = await $fetch<ApiResponse<User>>(`/api/users/${id}`);
  if (response.success) {
    user.value = response.data;
  }
};
</script>
```

### CI/CD Integration

```yaml
name: Build

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm ci

      - name: Generate TypeScript types
        run: npx typesharp

      - name: Build frontend
        run: npm run build
```

## Troubleshooting

### No types generated

- Verify `[TypeSharp]` attribute is on your C# classes or records
- Check that `source` points to the correct `.csproj`, `.sln`, or `.slnx` file
- Ensure C# files are not in `bin/` or `obj/` folders
- Verify your classes are decorated with the `[TypeSharp]` attribute

### Paths not found

- Use absolute paths on Windows: `C:/Users/User/Desktop/MyApp/MyApp.sln`
- Use absolute paths on Mac/Linux: `/home/user/projects/MyApp/MyApp.sln`

### Record parameters not appearing

- Ensure you are using `[TypeSharp]` on the record itself
- For attribute overrides on primary constructor parameters, use the `property:` target: `[property: TypeIgnore]`, `[property: TypeAs("Date")]`
- Body-only records (no primary constructor) are parsed from their `{ get; set; }` properties as normal

### Import errors in generated files

Ensure all types referenced by a decorated class or record are also decorated with `[TypeSharp]`. When using `singleOutputFile: false`, TypeSharp generates imports between files automatically.

### C# interfaces appearing in extends

This should not happen as of `v0.1.2`. TypeSharp automatically strips any base type matching the C# interface naming convention (`I` + uppercase letter) for both classes and records.

### Union enum not generating correctly

Ensure:

- You have both `[TypeSharp]` AND `[Union]` attributes on the enum
- The attributes appear directly before the `enum` keyword (they can be stacked, on one line with comma, or in any order)
- The enum has values defined: `public enum Status { Active, Inactive }`
- Without `[Union]`, a standard TypeScript `enum` is generated instead

### Getting Help

1. Check this documentation
2. Review the [README.md](../README.md)
3. Search [GitHub Issues](https://github.com/siyavuyachagi/typesharp/issues)
4. Open a new issue with your TypeSharp version, Node.js version, sample C# code, config file, and error messages

## Best Practices

### Run TypeSharp Before Dev/Build

```json
{
  "scripts": {
    "predev": "typesharp",
    "prebuild": "typesharp",
    "dev": "nuxt dev",
    "build": "nuxt build"
  }
}
```

### Use Union Enums for State/Status Types

For enums that represent application state, status values, or are used in discriminated unions, use `[Union]` to get better type safety and tree-shaking:

```csharp
[TypeSharp]
[Union]
public enum UserRole { Admin, User, Guest }

[TypeSharp]
[Union]
public enum OrderStatus { Pending, Shipped, Delivered, Cancelled }

[TypeSharp]
public enum Priority { Low, Medium, High }  // Simple value grouping → standard enum
```

### Commit Generated Types

Committing generated types means they are always available without a build step, and changes are reviewable in PRs.

### Only Decorate DTOs and Records Used by the Frontend

```csharp
[TypeSharp]
public class UserDto { }              // ✅ shared with frontend
[TypeSharp]
public record ProductSummary(...) { } // ✅ shared with frontend

public class UserEntity { }           // ❌ EF Core entity — keep internal
public record InternalEvent(...) { }  // ❌ internal domain event — keep internal
```

### Use Generic Types for API Responses

```csharp
[TypeSharp]
public class ApiResponse<T>
{
  public bool Success { get; set; }
  public string? Message { get; set; }
  public T? Data { get; set; }
}

[TypeSharp]
public record PagedResult<T>(IEnumerable<T> Items, int TotalCount);
```

```typescript
const userResponse = await $fetch<ApiResponse<User>>('/api/users/1');
const productsResponse = await $fetch<PagedResult<ProductSummary>>('/api/products');
```

---

**Need more help?** Check the [README.md](../README.md) or open an issue on [GitHub](https://github.com/siyavuyachagi/typesharp/issues)!
