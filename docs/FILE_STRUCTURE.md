## Project structure

```
typesharp/
├── bin/
│   └── typesharp.js                                    ✅ CLI executable
├── dist/                                               ✅ Compiled output (committed)
│   ├── cli/
│   ├── core/
│   ├── generator/
│   ├── helpers/
│   ├── parser/
│   ├── scripts/
│   └── types/
├── docs/                                               ✅ Documentation
│   ├── DEVELOPER_GUIDE.md
│   ├── FEATURE_IMPLEMENTATION_PLAN.md
│   ├── FILE_STRUCTURE.md
│   ├── PRE_RELEASE_GUIDE.md
│   ├── TECH_STACK.md
│   ├── USAGE.md
│   └── WHY_TYPESHARP.md
├── public/
├── src/
│   ├── cli/
│   │   └── index.ts                                    ✅ CLI entry point (commander)
│   ├── core/
│   │   ├── create-sample-config.ts                     ✅ Sample config generation (init command)
│   │   ├── index.ts                                    ✅ Config loading, merging, generate()
│   │   └── watch.ts                                    ✅ Watch mode implementation
│   ├── generator/
│   │   ├── generate-enum.ts
│   │   └── index.ts                                    ✅ TypeScript file generation
│   ├── helpers/                                        ✅ Shared utilities
│   │   ├── change-tracker.ts
│   │   ├── logger.ts
│   │   └── watcher.ts
│   ├── parser/
│   │   ├── index.ts                                    ✅ C# file parsing
│   │   ├── parse-classes-from-file.ts                  ✅ .sln/.slnx/.csproj resolution
│   │   └── parse-properties.ts                         ✅ Property parsing logic
│   ├── scripts/
│   │   └── pre-uninstall.ts
│   ├── types/
│   │   ├── index.ts                                    ✅ Shared TypeScript types
│   │   ├── naming-convention-config.ts                 ✅ NamingConventionConfig type
│   │   ├── naming-convention.ts                        ✅ NamingConvention enum
│   │   └── typesharp-config.ts                         ✅ TypeSharpConfig interface
│   └── index.ts                                        ✅ Barrel exports
├── tests/
│   ├── config/                                         ✅ Test config files (.ts, .js, .json)
│   ├── core/                                           ✅ Unit tests: mergeWithDefaults, createSampleConfig
│   ├── generators/                                     ✅ Unit tests: generateTypeScriptFiles
│   ├── helpers/
│   ├── integration/                                    ✅ Real project integration tests
│   └── parsers/                                        ✅ Unit tests: parser, resolve-project-files
├── .eslintignore
├── .eslintrc.json
├── .gitattributes
├── .gitignore                                          ✅ Git ignore
├── .prettierignore
├── .prettierrc
├── CHANGELOG.md                                        ✅ Version history
├── CODE-OF-CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE                                             ✅ MIT License
├── package-lock.json
├── package.json                                        ✅ Package config
├── README.md                                           ✅ Documentation
├── tsconfig.json                                       ✅ TypeScript config
├── typesharp.config.ts                                 ✅ TypeSharp self-config
└── vitest.config.ts                                    ✅ Test config
```
