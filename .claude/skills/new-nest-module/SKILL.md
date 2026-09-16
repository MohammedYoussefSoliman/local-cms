---
name: new-nest-module
description: Scaffold a complete NestJS feature module in apps/api — module, controller, service, DTOs, and spec — following the module-structure, auth, HTTP-contract and TypeORM rules. Usage: /new-nest-module locales [entity-name]
---

# New NestJS Feature Module

Scaffold a feature module following `.claude/rules/nestjs-module-structure.md`.
Use `apps/api/src/modules/auth/` as the canonical reference.

---

## Arguments

- `$1` — feature name, kebab-case plural (`locales`, `translation-modules`)
- `$2` — optional entity name from `@cms/database` (`Locale`,
  `TranslationModule`). Defaults to the singular PascalCase of `$1`.

---

## Before creating files

1. Confirm the entity exists in `libs/database/src/entities/`. If it does not,
   stop and say so — entities and their migration come first, and creating a
   service against a non-existent entity produces code that cannot compile.
2. Check the name against the collision rule: if the domain concept is
   "module", the Nest module is `TranslationModulesModule` and the directory
   is `translation-modules/`. Never `ModulesModule`.
3. Read the relevant section of `docs/Localization-CMS-Initial-Architecture.md`
   §9 for the endpoints this feature owns.
4. Decide the role for each endpoint now, not later. Ask the user if §5 does
   not settle it.

---

## Directory to create

```
apps/api/src/modules/{feature}/
  {feature}.module.ts
  {feature}.controller.ts
  {feature}.service.ts
  {feature}.service.spec.ts
  dto/
    create-{singular}.dto.ts
    update-{singular}.dto.ts
    list-{feature}.query.dto.ts
```

---

## Templates

### `{feature}.service.ts`

```ts
import { {Entity} } from '@cms/database';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { Create{Entity}Dto } from './dto/create-{singular}.dto';
import type { List{Feature}QueryDto } from './dto/list-{feature}.query.dto';

@Injectable()
export class {Feature}Service {
  constructor(
    @InjectRepository({Entity})
    private readonly {feature}: Repository<{Entity}>,
  ) {}

  async findAll(query: List{Feature}QueryDto) {
    const [records, total] = await this.{feature}.findAndCount({
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      order: { createdAt: 'DESC' },
    });

    return {
      records,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findById(id: string) {
    const record = await this.{feature}.findOne({ where: { id } });
    if (!record) throw new NotFoundException('{Entity} not found.');
    return record;
  }

  create(dto: Create{Entity}Dto) {
    // No pre-check for uniqueness: the unique index is the check, and
    // HttpExceptionFilter turns a 23505 into a 409.
    return this.{feature}.save(this.{feature}.create(dto));
  }
}
```

Every list method is paginated. Never `find()` a table that grows.

### `{feature}.controller.ts`

```ts
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';

import { Roles } from '@/common/decorators/roles.decorator';
import { Create{Entity}Dto } from './dto/create-{singular}.dto';
import { List{Feature}QueryDto } from './dto/list-{feature}.query.dto';
import { {Feature}Service } from './{feature}.service';

@Controller('{feature}')
export class {Feature}Controller {
  constructor(private readonly {feature}: {Feature}Service) {}

  @Get()
  findAll(@Query() query: List{Feature}QueryDto) {
    return this.{feature}.findAll(query);
  }

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.{feature}.findById(id);
  }

  @Roles('admin')
  @Post()
  create(@Body() dto: Create{Entity}Dto) {
    return this.{feature}.create(dto);
  }
}
```

- Return plain data — `ResponseInterceptor` adds the envelope.
- `ParseUUIDPipe` on every id param: without it a malformed id reaches
  Postgres and comes back as a 500 rather than a 400.
- Every mutating route carries `@Roles()` or an explicit `// no-role:` comment.

### `dto/list-{feature}.query.dto.ts`

```ts
import { PaginationQueryDto } from '@/common/dto/pagination.dto';

export class List{Feature}QueryDto extends PaginationQueryDto {}
```

### `{feature}.module.ts`

```ts
import { {Entity} } from '@cms/database';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { {Feature}Controller } from './{feature}.controller';
import { {Feature}Service } from './{feature}.service';

@Module({
  imports: [TypeOrmModule.forFeature([{Entity}])],
  controllers: [{Feature}Controller],
  providers: [{Feature}Service],
  exports: [{Feature}Service],
})
export class {Feature}Module {}
```

### `{feature}.service.spec.ts`

Mock the repository with `getRepositoryToken({Entity})`. Write at least one
test for a **domain invariant** this feature owns, not for `repo.save` being
called. See `.claude/rules/nestjs-testing.md`.

---

## After scaffolding

1. Register the module in `apps/api/src/app.module.ts`.
2. Add the shared payload/response types to `libs/contracts/src/` and make the
   DTO implement the payload type, so the two cannot drift.
3. If the feature touches translation values, re-read
   `.claude/rules/cms-domain-invariants.md` — publication status, append-only
   history, and optimistic locking all apply.
4. Report the endpoint table: method, path, role, and whether it is public.
