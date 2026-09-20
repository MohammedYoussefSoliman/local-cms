---
paths:
  - 'apps/backend/src/modules/**'
---

# NestJS Feature Module Structure

Every feature in `apps/backend/src/modules/` follows this shape. Use
`apps/backend/src/modules/auth/` as the canonical reference.

---

## Required files

```
apps/backend/src/modules/{feature}/
  {feature}.module.ts       ← wiring only
  {feature}.controller.ts   ← HTTP surface; no business logic
  {feature}.service.ts      ← business logic; no HTTP types
  {feature}.service.spec.ts ← unit tests for the service
  dto/
    create-{thing}.dto.ts   ← one DTO per file, class-validator decorated
    update-{thing}.dto.ts
  strategies/               ← passport strategies (auth only)
```

Entities do **not** live here. They live in `libs/database/src/entities/` and
are imported via `TypeOrmModule.forFeature([...])`, because the migration CLI
and the seeder need them without booting Nest.

---

## The `Module` naming collision

The domain has a concept called a "module" (a translation namespace) and
NestJS has `@Module()`. Never let the two share a name.

| Concept                          | Name                        |
| -------------------------------- | --------------------------- |
| Translation namespace (entity)   | `TranslationModule`         |
| Its Nest feature module          | `TranslationModulesModule`  |
| Its directory                    | `modules/translation-modules/` |
| Its table                        | `modules`                   |

`export class Module` in an entity file makes every `@Module()` import in the
file ambiguous, and the error TypeScript gives points at the decorator rather
than at the import.

---

## Controllers are thin

A controller maps HTTP to a service call and nothing else. No repository
access, no conditionals on domain state, no transaction handling.

```ts
// ✅
@Post()
create(@Body() dto: CreateAppDto, @CurrentUser('sub') userId: string) {
  return this.apps.create(dto, userId);
}

// ❌ — domain logic and data access in the HTTP layer
@Post()
async create(@Body() dto: CreateAppDto) {
  const existing = await this.repo.findOne({ where: { slug: dto.slug } });
  if (existing) throw new ConflictException();
  return this.repo.save(this.repo.create(dto));
}
```

The test for "is this logic in the right place" is simple: if the importer CLI
would need to duplicate it, it belongs in the service.

---

## Services never import HTTP types

A service throws domain-meaningful Nest exceptions (`NotFoundException`,
`ConflictException`, `ForbiddenException`) — those are fine, they are part of
the shared vocabulary. What a service must not touch is `Request`, `Response`,
headers, cookies, or `@nestjs/swagger` decorators. The importer and the
scheduled jobs call the same services with no HTTP anywhere in sight.

---

## Return plain data, never the envelope

`ResponseInterceptor` wraps every successful response in
`HTTPResponseType<T>`. A controller that builds its own envelope produces
`{ data: { data: ... } }`.

```ts
// ✅
return this.apps.findAll(query);

// ❌
return { data: await this.apps.findAll(query), statusCode: 200, message: null };
```

---

## Module wiring

- Import only what the feature needs. A feature that imports
  `TypeOrmModule.forFeature([...])` for an entity it never queries is a
  dependency nobody can prune later.
- Export the service when another feature genuinely needs it (`UsersModule`
  exports `UsersService` for `AuthModule`). Never export a repository.
- Cross-feature access goes through the other feature's **service**, never
  through its repository or its controller.

```ts
// ❌ — reaches around UsersModule's public surface
TypeOrmModule.forFeature([User]) // inside AuthModule

// ✅
imports: [UsersModule] // and inject UsersService
```

---

## Registering a new feature

1. Create the directory and the four required files.
2. Add the feature module to `AppModule.imports`.
3. Decide, explicitly, which endpoints carry `@Roles()` — see
   `.claude/rules/nestjs-auth.md`. "No role restriction" is a valid answer but
   must be a deliberate one.
4. Add the service spec in the same commit, not afterwards.
