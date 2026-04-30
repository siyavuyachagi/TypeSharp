# Pre-Release Guide

## 1. Decide the Version Number

Use [Semantic Versioning](https://semver.org/):

| Change type | Bump | Example |
|---|---|---|
| Breaking change (removes/renames a config option or output format) | Major | `0.1.1` → `1.0.0` |
| New feature (backwards-compatible) | Minor | `0.1.1` → `0.2.0` |
| Bug fix or internal improvement | Patch | `0.1.1` → `0.1.2` |
| Pre-release / beta | Pre | `0.2.0-beta.1` |

Decide your new version before touching any files. Everything below references it.

---

## 2. Files to Update (in order)

### 2.1 `package.json`

```json
{
  "version": "X.X.X"
}
```

- [✓] Version bumped to the new version

---

### 2.2 `CHANGELOG.md`

Add a new section at the top (below the `## Important note` block), following the existing format:

```md
## vX.X.X - YYYY-MM-DD

### Summary
One or two sentences describing the release theme.

### Added
- New features

### Changed
- Changed behaviour or config options

### Fixed
- Bug fixes

### Removed  ← only if something was removed
- Removed features
```

- [✓] New version section added at the top
- [✓] Date is today's date in `YYYY-MM-DD` format
- [✓] Every user-facing change from this release is listed
- [✓] Breaking changes are clearly called out under **Changed** or a dedicated **Breaking Changes** subsection
- [✓] Internal/refactor changes that don't affect users are omitted or kept minimal

---

### 2.3 `README.md`

Go through the whole README and ask for each section:

- [✓] **Features list** — does it reflect any new features added?
- [✓] **Installation** — still accurate? No version pinning that needs updating?
- [✓] **Quick Start** — does the example still work end-to-end with the new version?
- [✓] **Configuration table** — are all config options listed with correct types, defaults, and descriptions?
- [✓] **Type Mappings tables** — any new C# types added to the parser? Add them here.
- [✓] **Advanced Examples** — do all code examples reflect current behaviour?
- [✓] **How TypeSharp Compares table** — does it still accurately represent capabilities vs competitors?
- [✓] **Requirements** — Node.js and TypeScript version requirements still accurate?
- [✓] **npm version badge** — this updates automatically via shields.io, but confirm the package name is correct

---

### 2.4 `docs/usage.md`

- [✓] **Configuration Options table** — matches `TypeSharpConfig` interface exactly
- [✓] **Type Mappings tables** — matches `mapCSharpTypeToTypeScript` in `src/parser/index.ts`
- [✓] **Naming Convention table** — matches all cases in `convertFileName` in `src/generator/index.ts`
- [✓] **CLI Usage section** — all commands, flags, and defaults still accurate
- [✓] **Integration Examples** — do Nuxt/Vue examples still work with the current output format?
- [✓] **Troubleshooting** — any new common errors worth documenting?

---

### 2.5 `docs/why-typesharp.md`

- [✓] **Roadmap section** — move completed items out of the roadmap; update in-progress items
- [✓] **How TypeSharp Compares table** — keep in sync with the one in `README.md`

---

### 2.6 `docs/prject-structure.md`

- [✓] Structure matches the actual `src/` layout (new files or folders added?)
- [✓] All status indicators (`✅`) are accurate

---

## 3. Code Checks

- [✓] `npm run build` — passes with **zero** TypeScript errors
- [✓] `npm test` — all tests pass
- [✓] `dist/` is up to date — run `npm run build` one final time after all source edits
- [✓] No `console.log` debug statements left in `src/parser` or `src/generator`
- [✓] No commented-out code left unintentionally (e.g. the `autoPropertyRegex` block in `src/parser/index.ts` — decide: remove it or restore it)
- [✓] `package.json` `"files"` array is correct — only `bin/`, `dist/`, `README.md`, `LICENSE` are published; `src/`, `tests/`, `docs/` are excluded

---

## 4. Things Commonly Forgotten

These are easy to miss. Check them explicitly every release:

- [✓] **`package-lock.json`** — if you updated any dependencies, commit the updated lock file
- [✓] **`dist/` committed** — your `package.json` `"files"` publishes from `dist/`. If `dist/` is gitignored but not npmignored, make sure the build runs during publish (your `prepublishOnly` script handles this — confirm it's still there)
- [✓] **`.gitignore` vs npm publish** — `dist/` is commented out in `.gitignore` (you're committing it). Make sure this is intentional and consistent
- [✓] **`bin/typesharp.js` shebang** — the `#!/usr/bin/env node` line must remain at the top; do not accidentally strip it
- [✓] **Sample config in `createSampleConfig`** — if you added a new config option, add it to the sample config object in `src/core/index.ts` so `npx typesharp init` generates it for new users
- [✓] **Default config values** — if a new option has a default, it must be in `DEFAULT_CONFIG` in `src/core/index.ts`, not just in the interface
- [✓] **`fileSuffix: ''` in sample** — currently generates with an empty string. Decide if that should be omitted or kept for discoverability
- [✓] **CHANGELOG date** — easy to paste the wrong date if copying from a previous entry

---

## 5. Git

```bash
# Make sure you're on main and up to date
git checkout main
git pull origin main

# Stage all changes
git add .

# Commit with a clear message
git commit -m "chore: release vX.X.X"

# Tag the release
git tag vX.X.X

# Push commits and tag
git push origin main
git push origin vX.X.X
```

- [✓] All changes committed on `main`
- [✓] Tag created as `vX.X.X` (with the `v` prefix)
- [✓] Tag pushed to origin

---

## 6. GitHub Release

1. Go to [https://github.com/siyavuyachagi/typesharp/releases/new](https://github.com/siyavuyachagi/typesharp/releases/new)
2. Select the tag you just pushed (`vX.X.X`)
3. Set the release title: `vX.X.X`
4. Paste the relevant `CHANGELOG.md` section as the release body
5. For pre-releases (`-beta`, `-alpha`, `-rc`): check **"Set as a pre-release"**
6. Click **Publish release**

- [✓] GitHub Release created and published
- [✓] Release body matches the CHANGELOG entry
- [✓] Pre-release checkbox set correctly

> Publishing the GitHub Release triggers the `publish.yml` workflow automatically. It builds and publishes to npm under the `latest` tag (or `beta` tag for pre-release versions).

---

## 7. Verify the npm Publish

After the GitHub Actions workflow completes (usually under 2 minutes):

```bash
# Check the published version on npm
npm view @siyavuyachagi/typesharp version

# Or check the full package info
npm view @siyavuyachagi/typesharp
```

- [✓] npm shows the correct new version
- [✓] `npm install -D @siyavuyachagi/typesharp` installs the correct version in a test project
- [✓] `npx typesharp --version` prints the correct version

---

## 8. Post-Release

- [✓] Close any GitHub Issues that were resolved in this release
- [✓] Reply to any open Issues or PRs that were waiting on this release
- [✓] If this was a breaking change, check if the [npm README](https://www.npmjs.com/package/@siyavuyachagi/typesharp) rendered correctly (it mirrors `README.md`)
- [✓] Update the roadmap in `docs/why-typesharp.md` — move shipped items, add next targets

---

## Quick Reference: Version Locations

Every release touches these version strings.

| File | Location |
|---|---|
| `package.json` | `"version": "X.X.X"` |
| `CHANGELOG.md` | New `## vX.X.X - YYYY-MM-DD` section |
| `README.md` | Features, config table, requirements |
| `docs/usage.md` | Config options, type mappings, CLI usage |
| `docs/why-typesharp.md` | Roadmap, comparisons |
| `docs/project-structure.md` | Structure and status indicators |