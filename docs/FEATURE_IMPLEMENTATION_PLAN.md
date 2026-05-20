# TypeSharp – Feature Implementation Plan

> **Repo:** [github.com/siyavuyachagi/typesharp](https://github.com/siyavuyachagi/typesharp)  
> **Goal:** Automatically generate TypeScript interfaces from C# models — keeping ASP.NET Core + Vue/Nuxt/React projects in sync.

---

## Implemented Features

### 1. Watch Mode ✅

#### Usage

```bash
typesharp generate --watch
typesharp generate --watch --config ./typesharp.config.ts
typesharp generate --watch --no-incremental
```

#### Behavior

1. Scan project for eligible models
2. Generate initial TypeScript output
3. Monitor `*.cs` and `*.csproj` for changes
4. Identify affected models only
5. Regenerate and write updated `.ts` files
6. (Optional) Trigger frontend HMR reload

#### Architecture

```
watch.ts (startWatch)
 ├── watcher.ts (watchDirectory)   ← fs.watch recursive on cwd()
 ├── Debounce timer                ← 300ms, batches rapid saves
 └── generate(configPath, true)    ← always incremental after initial run
```

#### Key Rules

- Watches entire `cwd()`, not just `*.cs` — output dir and common non-source dirs (`node_modules`, `.git`, `dist`, `.nuxt`, etc.) are filtered out
- Debounce window: 300ms — batches rapid saves (e.g. formatter on save)
- Skips if a generation is already in progress (`isGenerating` guard)
- Initial run respects the `--no-incremental` flag; all subsequent runs are always incremental
- Hashing inside `generate()` determines which models actually changed

---

## Planned Features (Priority Order)

---

### 1. Performance Optimization

**Why next:** Needed once watch mode is in use at scale.

#### Target scale: 500–2000+ models

#### Strategies

**Incremental Generation**  
Track which C# files changed → resolve affected models → regenerate only those outputs.

**Hash-Based Caching**  
Cache `{ modelHash → generatedOutput }`. Skip generation entirely if hash is unchanged.

**Parallel Processing**

```csharp
Parallel.ForEach(models, model => Generate(model));
```

**Skip Unchanged File Writes**

```csharp
if (existingContent == generatedContent) return; // avoids unnecessary FS writes
```

Prevents frontend build tools (Vite, webpack) from triggering rebuilds on untouched files.

---

### 2. VS Code Extension

**Why last:** Polishes the developer experience once core features are solid.

#### Commands

| Command                         | Action                                                  |
| ------------------------------- | ------------------------------------------------------- |
| `TypeSharp: Generate Types`     | Runs `typesharp generate`                               |
| `TypeSharp: Start Watch Mode`   | Starts `typesharp watch`                                |
| `TypeSharp: Stop Watch Mode`    | Stops the watcher process                               |
| `TypeSharp: Preview TypeScript` | Right-click a C# model → preview output without writing |

#### Diagnostics

Surface warnings inline for unsupported types:

```
⚠ Unsupported type: Tuple<int, string> in UserModel.cs
```

#### Architecture

```
VSCode Extension → child_process.spawn(CLI) → Display in editor panel
```

#### File Structure

>

---

## Success Criteria

| Feature           | Done When                                                  |
| ----------------- | ---------------------------------------------------------- |
| Watch Mode        | ✅ Done                                                    |
| Performance       | 1000+ model project generates in under 5 seconds           |
| VS Code Extension | Generate, watch, and preview all work from command palette |

---

## Future Enhancements

- Nuxt module (auto-imports generated types)
- Vite plugin (HMR integration)
- TypeScript client generation (fetch/axios)
- AST-based transformations
- VS Code extension (generate, watch, preview from command palette)
