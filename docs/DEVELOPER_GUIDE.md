# TypeSharp Developer Guide

> A CLI tool for generating TypeScript types from C# classes.  
> Package: `@siyavuyachagi/typesharp`

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Structure](#2-repository-structure)
3. [Branching Strategy](#3-branching-strategy)
4. [Commit Style](#4-commit-style)
5. [Naming Conventions](#5-naming-conventions)
6. [Configuration Reference](#6-configuration-reference)
7. [Adding a New Feature](#7-adding-a-new-feature)
8. [Testing Guidelines](#8-testing-guidelines)
9. [Release Process](#9-release-process)
10. [Changelog Format](#10-changelog-format)
11. [Code Style](#11-code-style)

---

## 1. Project Overview

TypeSharp reads annotated C# classes and emits TypeScript interfaces and enums — keeping frontend types in sync with backend models automatically.

**Pipeline:**

```
.sln / .slnx / .csproj
        ↓
   parser/index.ts        ← finds [TypeSharp] classes
        ↓
 generator/index.ts       ← emits .ts interfaces & enums
        ↓
   outputPath/
```

---

## 2. Repository Structure

```
typesharp/
├── src/
│   ├── cli/            # CLI entry point (commander)
│   ├── core/           # Config loading, merging, generate()
│   ├── parser/         # C# file parsing + .sln/.slnx resolution
│   ├── generator/      # TypeScript file generation
│   └── types/          # Shared TypeScript types
├── tests/
│   ├── core/           # Unit tests: mergeWithDefaults, createSampleConfig
│   ├── parser/         # Unit tests: parser, resolve-project-files
│   ├── generator/      # Unit tests: generateTypeScriptFiles
│   ├── integration/    # Real project integration tests
│   └── config/         # Test config files (.ts, .js, .json)
├── AspNetCore/         # ASP.NET Core test project (Domain + API)
├── typesharp.config.ts
├── vitest.config.ts
└── package.json
```

---

## 3. Branching Strategy

TypeSharp uses a trunk-based branching model.

| Branch              | Purpose                                 | Merges into |
| ------------------- | --------------------------------------- | ----------- |
| `main`              | Stable, releasable. Protected.          | —           |
| `dev`               | Active development integration branch   | `main`      |
| `feat/<n>`          | New features                            | `dev`       |
| `fix/<n>`           | Bug fixes                               | `dev`       |
| `chore/<n>`         | Maintenance, deps, tooling              | `dev`       |
| `docs/<n>`          | Documentation only                      | `dev`       |
| `test/<n>`          | Adding or fixing tests only             | `dev`       |
| `refactor/<n>`      | Code restructuring, no behaviour change | `dev`       |
| `release/<version>` | Release preparation                     | `main`      |

> **Rule:** Never commit directly to `main`. All work goes through `dev` or a feature branch.

### Examples

```
feat/slnx-support
feat/watch-mode
fix/nullable-array-double-bracket
fix/sln-path-resolution-windows
chore/update-vitest
docs/developer-guide
test/parser-edge-cases
refactor/generator-naming-convention
release/1.2.0
```

---

## 4. Commit Style

TypeSharp follows [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer — BREAKING CHANGE or issue refs]
```

### Types

| Type       | When to use                                          |
| ---------- | ---------------------------------------------------- |
| `feat`     | A new feature or capability                          |
| `fix`      | A bug fix                                            |
| `chore`    | Maintenance, dependency updates, tooling config      |
| `docs`     | Documentation changes only                           |
| `test`     | Adding or updating tests (no production code change) |
| `refactor` | Code change that is neither a fix nor a feature      |
| `perf`     | Performance improvement                              |
| `style`    | Formatting, whitespace — no logic change             |
| `ci`       | CI/CD pipeline changes                               |
| `build`    | Build system or external dependency changes          |
| `revert`   | Reverts a previous commit                            |

### Scopes

Use the module name as scope:

`cli` · `core` · `parser` · `generator` · `types` · `config` · `tests`

### Examples

```bash
# Feature with scope
feat(parser): add .slnx solution file support

# Bug fix
fix(generator): prevent double [] on Record types

# Deprecation — explain in body
chore(config): deprecate projectFiles in favour of source

BREAKING CHANGE: projectFiles will be removed in v2.0.0.
Rename it to `source` in your typesharp.config file.

# Tests only
test(parser): add edge cases for nullable Dictionary types

# Docs — no scope needed
docs: add developer guide

# Chore — no scope needed
chore: bump vitest to 2.x

# Release
chore(release): bump version to 1.2.0
```

### Rules

- Use imperative mood — `"add support"` not `"added support"`
- Keep the subject line under **72 characters**
- Do not end the subject line with a period
- Use the body to explain **what** and **why**, not how
- Reference issues in the footer: `Closes #12`

---

## 5. Naming Conventions

### 5.1 Files & Directories

| Context      | Convention             | Example                                |
| ------------ | ---------------------- | -------------------------------------- |
| Source files | `kebab-case`           | `resolve-project-files-from-source.ts` |
| Test files   | `kebab-case` + `.test` | `parser.test.ts`                       |
| Type files   | `kebab-case`           | `naming-convention-config.ts`          |
| Config files | `kebab-case`           | `typesharp.config.ts`                  |
| Directories  | `kebab-case`           | `src/parser/`                          |

### 5.2 TypeScript Source Code

| Item                           | Convention             | Example                                     |
| ------------------------------ | ---------------------- | ------------------------------------------- |
| Variables & parameters         | `camelCase`            | `projectFiles`, `outputPath`                |
| Functions                      | `camelCase`            | `parseCSharpFiles()`, `mergeWithDefaults()` |
| Classes                        | `PascalCase`           | `TypeSharpConfig`                           |
| Interfaces                     | `PascalCase`           | `CSharpClass`, `ParseResult`                |
| Type aliases                   | `PascalCase`           | `NamingConventionConfig`                    |
| Enums                          | `PascalCase`           | `NamingConvention`                          |
| Enum members (string literals) | `camelCase`            | `'kebab'`, `'snake'`, `'camel'`             |
| Constants                      | `SCREAMING_SNAKE_CASE` | `DEFAULT_CONFIG`                            |
| Module-level private helpers   | `camelCase`            | `formatAsJsObject()`                        |

### 5.3 Generated Output Files

Controlled by the `namingConvention` config option:

| Convention        | Output filename   |
| ----------------- | ----------------- |
| `camel` (default) | `userProfile.ts`  |
| `kebab`           | `user-profile.ts` |
| `pascal`          | `UserProfile.ts`  |
| `snake`           | `user_profile.ts` |

When using `NamingConventionConfig` (object form), `dir` and `file` can differ:

```ts
namingConvention: {
  dir: 'snake',   // directory names → my_feature/
  file: 'kebab',  // file names      → user-profile.ts
}
```

---

## 6. Configuration Reference

| Field              | Type                                         | Required | Default       | Notes                                    |
| ------------------ | -------------------------------------------- | -------- | ------------- | ---------------------------------------- |
| `source`           | `string \| string[]`                         | ✅       | —             | Path(s) to `.csproj`, `.sln`, or `.slnx` |
| `outputPath`       | `string`                                     | ✅       | —             | Where generated `.ts` files go           |
| `singleOutputFile` | `boolean`                                    | No       | `false`       | Merge all types into `types.ts`          |
| `namingConvention` | `NamingConvention \| NamingConventionConfig` | No       | `"camel"`     | File and directory naming                |
| `fileSuffix`       | `string`                                     | No       | `""`          | Suffix appended to output filenames      |
| `projectFiles`     | `string \| string[]`                         | No       | —             | ⚠️ Deprecated — use `source`             |

> ⚠️ **Deprecated:** `projectFiles` is deprecated. Rename it to `source`. It will be removed in a future major version.

---

## 7. Adding a New Feature

1. **Branch off `dev`:**

   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feat/<n>
   ```

2. **Implement in the correct layer:**

   | Change type           | Location                                              |
   | --------------------- | ----------------------------------------------------- |
   | Config field          | `src/types/typesharp-config.ts` + `src/core/index.ts` |
   | Parsing logic         | `src/parser/`                                         |
   | Output/generation     | `src/generator/index.ts`                              |
   | CLI command or option | `src/cli/index.ts`                                    |

3. **Export from `src/index.ts`** if the addition is part of the public API.

4. **Write tests:**
   - Unit test in the matching `tests/` folder
   - Update the integration test if the behaviour affects real project output

5. **Run tests:**

   ```bash
   npx vitest run
   ```

6. **Commit** using Conventional Commits, push, open a PR into `dev`.

---

## 8. Testing Guidelines

TypeSharp uses [Vitest](https://vitest.dev/). Tests are split into unit tests and one integration suite that runs against the real `AspNetCore/` test project.

### 8.1 Test File Locations

| Target                                            | Test file                                                |
| ------------------------------------------------- | -------------------------------------------------------- |
| `src/core/index.ts`                               | `tests/core/index.test.ts`                               |
| `src/core/create-sample-config.ts`                | `tests/core/create-sample-config.test.ts`                |
| `src/parser/index.ts`                             | `tests/parser/parser.test.ts`                            |
| `src/parser/resolve-project-files-from-source.ts` | `tests/parser/resolve-project-files-from-source.test.ts` |
| `src/generator/index.ts`                          | `tests/generator/generator.test.ts`                      |
| Real project (`AspNetCore/`)                      | `tests/integration/project.test.ts`                      |

### 8.2 Unit Test Rules

- Use `fs.mkdtempSync` for temp directories — always clean up in `finally` blocks
- In integration tests, use `findFileContaining(dir, 'export interface ClassName')` not just the class name — searching for `"Employee"` will match `developer.ts` which contains `extends Employee`
- Test one thing per `it()` block
- Name tests in plain English: `"maps DateTime → string"`, `"throws when source is missing"`
- Do not assert on console output — spy on it with `vi.spyOn` if needed

### 8.3 Running Tests

```bash
# All tests
npx vitest run

# Watch mode
npx vitest

# Single file
npx vitest run tests/parser/parser.test.ts

# Verbose output
npx vitest run --reporter=verbose
```

---

## 9. Release Process

1. Merge `dev` → `main` via PR. Ensure all tests pass.

2. Create a release branch:

   ```bash
   git checkout -b release/1.2.0
   ```

3. Bump version in `package.json`.

4. Update `CHANGELOG.md` — fill in the version, date, and sections.

5. Commit:

   ```bash
   git commit -m "chore(release): bump version to 1.2.0"
   ```

6. Merge into `main` and tag:

   ```bash
   git checkout main
   git merge release/1.2.0
   git tag v1.2.0
   git push origin main --tags
   ```

7. Publish to npm:

   ```bash
   npm publish --access public
   ```

8. Merge `main` back into `dev` to keep histories in sync:

   ```bash
   git checkout dev
   git merge main
   git push origin dev
   ```

---

## 10. Changelog Format

TypeSharp uses [Keep a Changelog](https://keepachangelog.com/) format. Unreleased changes are staged under `[Unreleased]` until a release is cut.

```markdown
# Changelog

## [Unreleased]

## [1.2.0] - 2025-06-01

### Added

- `.slnx` solution file support in `source` config
- `.sln` solution file parsing with automatic `.csproj` extraction

### Changed

- `projectFiles` deprecated in favour of `source`

### Fixed

- Double `[]` appended to `Record<>` types when `isArray` is true

## [1.1.0] - 2025-04-10

...
```

### Section Rules

| Section    | What goes here                                 |
| ---------- | ---------------------------------------------- |
| `Added`    | New features, config fields, file type support |
| `Changed`  | Behaviour changes, deprecations, renames       |
| `Fixed`    | Bug fixes                                      |
| `Removed`  | Deleted features or fields (breaking)          |
| `Security` | Vulnerability patches                          |

---

## 11. Code Style

- TypeScript **strict mode** — no implicit `any`
- Prefer **explicit return types** on all exported functions
- Use `const` over `let` wherever possible
- Use **early returns** to avoid deep nesting
- Extract long regex patterns into named constants with a comment explaining them
- All console output in `generate()` must use **chalk** — no bare `console.log` in library code
- Exported functions get **JSDoc**. Internal helpers do not need it unless complex.
- **No default exports** in `src/` except config files — use named exports
- If a function does more than one thing, **split it**. `parseCSharpFiles`, `generateTypeScriptFiles`, and `resolveProjectFilesFromSource` are each responsible for exactly one stage of the pipeline.
