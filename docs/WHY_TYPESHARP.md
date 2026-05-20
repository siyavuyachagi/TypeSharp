# Why TypeSharp

TypeSharp exists to solve a problem that OpenAPI-based tools deliberately ignore:

> **Sharing C# domain and DTO models with TypeScript without HTTP, Swagger, or controllers.**

If your models are not part of a public API contract—or you care about preserving structure, intent, and architecture—TypeSharp is the right tool.

---

## What TypeSharp Is (and Is Not)

### ✅ TypeSharp **IS**

* A **model-first** generator
* **C# source–driven** (AST-based)
* Attribute-controlled (`[TypeSharp]`)
* Architecture-aware (Domain / Application / Contracts)
* Frontend-friendly (naming, grouping, generics)

### ❌ TypeSharp **IS NOT**

* An API client generator
* A Swagger/OpenAPI replacement
* A runtime serializer
* A magic schema inference tool

If you need HTTP clients, auth flows, retries, or SDKs — use NSwag.

---

# Why Not Just Use OpenAPI / NSwag?

OpenAPI tools generate **API contracts**.
TypeSharp generates **shared models**.

| Problem                  | OpenAPI Tools | TypeSharp |
| ------------------------ | ------------- | --------- |
| Non-API models           | ❌             | ✅         |
| Domain-layer types       | ❌             | ✅         |
| Message/event contracts  | ❌             | ✅         |
| Attribute-driven opt-in  | ⚠️            | ✅         |
| File structure preserved | ❌             | ✅         |
| Requires controllers     | ✅             | ❌         |

If a model is not exposed over HTTP, OpenAPI will never see it.
TypeSharp will.

---

# Ideal Use Cases

TypeSharp is designed for:

* Clean Architecture projects
* Modular monoliths
* Internal admin tools
* Background workers
* Event-driven systems (queues, messages)
* Shared libraries
* Frontend consuming internal DTOs

If your frontend and backend evolve together, TypeSharp keeps them aligned **without leaking API concerns into your domain**.

---

# How TypeSharp Compares

| Feature               | TypeSharp | NSwag | openapi-typescript | TypeGen |
| --------------------- | --------- | ----- | ------------------ | ------- |
| Direct C# parsing     | ✅         | ❌     | ❌                  | ✅       |
| Attribute targeting   | ✅         | ⚠️    | ❌                  | ⚠️      |
| Non-API models        | ✅         | ❌     | ❌                  | ✅       |
| Generics preserved    | ✅         | ⚠️    | ⚠️                 | ⚠️      |
| File grouping         | ✅         | ❌     | ❌                  | ❌       |
| Naming control        | ✅         | ⚠️    | ⚠️                 | ❌       |
| API client generation | ❌         | ✅     | ❌                  | ❌       |

TypeSharp is not weaker — it is **more focused**.

---

# Design Philosophy

1. **Explicit is better than implicit**
   Models are generated only when annotated.

2. **Structure matters**
   Files, inheritance, and generics are preserved.

3. **No transport coupling**
   No HTTP, no Swagger, no controllers required.

4. **Frontend-first output**
   Naming, grouping, and nullability are intentional.

---

# Roadmap (Strategic)

These features would push TypeSharp into a category of its own:

### Short-term

* Record type support
* `Dictionary<TKey, TValue>` → `Record<K, V>`
* Nullable vs optional distinction
* Better error diagnostics

### Mid-term

* Partial class merging
* Incremental builds / watch mode
* Pluggable transformers
* Per-folder config overrides

### Long-term

* Discriminated unions from inheritance
* Event/message schema mode
* Monorepo-aware caching
* IDE tooling (VS / Rider)

---

# When NOT to Use TypeSharp

* You need API clients
* You rely heavily on OpenAPI tooling
* You don’t control both frontend and backend
* Your models only exist behind HTTP endpoints

In those cases, NSwag is the correct tool.

---

# Final Note

TypeSharp doesn’t compete with OpenAPI generators.

It fills the gap they intentionally leave behind.
