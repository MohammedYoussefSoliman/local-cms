---
paths:
  - 'apps/backend/**/*.spec.ts'
  - 'apps/backend/test/**'
---

# API Testing

Two layers, with different jobs. Do not blur them.

| Layer | File | Boots | Answers |
| --- | --- | --- | --- |
| Unit | `*.service.spec.ts` next to the service | `Test.createTestingModule` with mocked repositories | does the business rule hold? |
| E2E | `test/*.e2e-spec.ts` | the whole app against a real Postgres | does the HTTP contract hold? |

---

## Rule 1 — Services are unit-tested with mocked repositories

Use `getRepositoryToken(Entity)` to substitute a plain object of jest mocks.
A unit test that needs a database is an E2E test wearing the wrong name — it
is slower, it is flaky in CI, and it fails for reasons unrelated to the rule
it claims to check.

```ts
const moduleRef = await Test.createTestingModule({
  providers: [
    TranslationsService,
    { provide: getRepositoryToken(TranslationValue), useValue: mockRepo },
  ],
}).compile();
```

See `apps/backend/src/modules/auth/auth.service.spec.ts`.

---

## Rule 2 — Test the invariant, not the ORM

Nobody needs a test asserting that `repo.save` was called. Test the rule that
would be wrong if someone deleted a line:

- a replayed refresh token revokes **every** session for that user
- a `draft` value never appears in a runtime bundle
- a stale `expectedVersion` produces 409 rather than an overwrite
- a global module rejects a non-null `appId`
- enabling a second default locale for an app fails

Each of those maps to a rule in
`.claude/rules/cms-domain-invariants.md`. That file is the test backlog.

---

## Rule 3 — Every endpoint gets an auth test

Guards are global, which is exactly why they need asserting: a misordered
`APP_GUARD` or a stray `@Public()` breaks them silently and uniformly.

```ts
it('rejects an unauthenticated request', () =>
  request(app.getHttpServer()).get('/api/apps').expect(401));

it('rejects an editor', () =>
  request(app.getHttpServer())
    .post('/api/locales')
    .set('Authorization', `Bearer ${editorToken}`)
    .expect(403));
```

---

## Rule 4 — E2E runs against a real Postgres, migrated not synchronized

The constraints are the behaviour under test. An in-memory substitute has
neither the partial indexes nor the CHECKs, so it would pass tests the real
database fails.

```bash
pnpm db:up && pnpm migration:run && pnpm test:e2e
```

E2E specs run with `--runInBand` — parallel workers sharing one schema produce
failures that reproduce only in CI.

---

## Rule 5 — Each test owns its data

Create what the test needs and clean up after it. A spec that depends on a
seeded row passes alone and fails in a suite, and the failure blames whichever
test ran first.

Seeded **locales** (`ar`, `en`) are the deliberate exception — they are
bootstrap data, and `seedLocales` is idempotent.

---

## Rule 6 — Assert the envelope in E2E

The dashboard parses `{ data, message, statusCode }` on success and
`{ statusCode, message, error, fieldErrors }` on failure. An E2E test that
asserts only the status code would not notice the envelope disappearing.

```ts
const { body } = await request(server).get('/api/apps').expect(200);
expect(body).toMatchObject({ statusCode: 200, data: expect.any(Array) });
```
