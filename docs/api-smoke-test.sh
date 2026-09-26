#!/usr/bin/env bash
#
# End-to-end smoke test for the Localization CMS API, over HTTP, against a
# running backend. Every request below is one a dashboard will make.
#
#   pnpm db:up && pnpm migration:run && pnpm seed
#   pnpm dev:backend
#   ./docs/api-smoke-test.sh
#
# It creates its own application, module, entry, API key and a user, each
# suffixed with a run id, so it is safe to run repeatedly and never touches
# data you were looking at. Nothing is deleted, and the API has no
# `DELETE /apps` — clean up in SQL when the rows start getting in the way:
#
#   docker exec -it local-cms-postgres psql -U cms -d localization_cms \
#     -c "DELETE FROM apps WHERE slug LIKE 'smoke-%'" \
#     -c "DELETE FROM users WHERE email LIKE 'smoke-editor-%'"
#
# Deleting an app cascades to its modules, entries, values and history.
#
# Environment:
#   API_BASE   default http://localhost:4050/api
#   ADMIN_EMAIL / ADMIN_PASSWORD   the bootstrap admin from `pnpm seed`

set -euo pipefail

API="${API_BASE:-http://localhost:4050/api}"
ADMIN_EMAIL="${ADMIN_EMAIL:-${BOOTSTRAP_ADMIN_EMAIL:-admin@example.com}}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-${BOOTSTRAP_ADMIN_PASSWORD:-}}"
RUN="$(date +%s)"
JSON='Content-Type: application/json'

if [ -z "$ADMIN_PASSWORD" ]; then
  echo "Set ADMIN_PASSWORD (or BOOTSTRAP_ADMIN_PASSWORD) to the seeded admin's password." >&2
  exit 1
fi

pass=0
fail=0

# --- tiny helpers -----------------------------------------------------------

# Reads one dotted path out of a JSON document on stdin. node rather than jq,
# so the script has no dependency the repo does not already have.
jget() {
  node -e '
    let raw = "";
    process.stdin.on("data", (c) => (raw += c));
    process.stdin.on("end", () => {
      let value;
      try { value = JSON.parse(raw); } catch { process.stdout.write(""); return; }
      for (const key of process.argv[1].split(".")) value = value?.[key];
      process.stdout.write(value === undefined || value === null ? "" : String(value));
    });
  ' "$1"
}

step() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# check <expected-status> <label> -- curl args...
check() {
  local expected="$1" label="$2"; shift 3
  local status
  status="$(curl -s -o /tmp/cms-smoke-body -w '%{http_code}' "$@")"
  if [ "$status" = "$expected" ]; then
    printf '  \033[32m✓\033[0m %-56s %s\n' "$label" "$status"
    pass=$((pass + 1))
  else
    printf '  \033[31m✗\033[0m %-56s expected %s, got %s\n' "$label" "$expected" "$status"
    printf '      %s\n' "$(head -c 300 /tmp/cms-smoke-body)"
    fail=$((fail + 1))
  fi
}

# ---------------------------------------------------------------------------

step "00  Health — the only endpoint that needs no credential at all"
check 200 "GET /health" -- "$API/health"

step "01  Log in as the bootstrap admin"
LOGIN="$(curl -s -X POST "$API/auth/login" -H "$JSON" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")"
TOKEN="$(printf '%s' "$LOGIN" | jget data.accessToken)"

if [ -z "$TOKEN" ]; then
  echo "  Login failed: $LOGIN" >&2
  exit 1
fi
AUTH="Authorization: Bearer $TOKEN"
printf '  \033[32m✓\033[0m access token acquired (expires in %ss)\n' \
  "$(printf '%s' "$LOGIN" | jget data.expiresIn)"
pass=$((pass + 1))

step "02  Languages are rows — adding one is an API call, not a migration"
check 200 "GET /locales" -- "$API/locales" -H "$AUTH"
curl -s -X POST "$API/locales" -H "$AUTH" -H "$JSON" \
  -d '{"code":"fr","name":"French","nativeName":"Français"}' >/dev/null
# Second one is the unique index answering, not a pre-check in the service.
check 409 "POST /locales {fr} again → 409 from uq_locales_code" -- \
  -X POST "$API/locales" -H "$AUTH" -H "$JSON" \
  -d '{"code":"fr","name":"French","nativeName":"Français"}'

step "03  An application, and a second language switched on"
APP_SLUG="smoke-$RUN"
APP="$(curl -s -X POST "$API/apps" -H "$AUTH" -H "$JSON" \
  -d "{\"name\":\"Smoke $RUN\",\"slug\":\"$APP_SLUG\",\"defaultLocaleCode\":\"en\"}" \
  | jget data.id)"
printf '  app id %s (slug %s)\n' "$APP" "$APP_SLUG"
check 200 "POST /apps/:id/locales/ar/enable" -- \
  -X POST "$API/apps/$APP/locales/ar/enable" -H "$AUTH"
# The slug is compiled into deployed client bundles, so it is not in the DTO.
check 400 "PATCH /apps/:id {slug} → 400 at the pipe" -- \
  -X PATCH "$API/apps/$APP" -H "$AUTH" -H "$JSON" -d '{"slug":"renamed"}'
check 422 "DELETE the default locale → 422" -- \
  -X DELETE "$API/apps/$APP/locales/en/disable" -H "$AUTH"

step "04  A namespace and a key"
MODULE="$(curl -s -X POST "$API/apps/$APP/modules" -H "$AUTH" -H "$JSON" \
  -d '{"name":"Checkout","slug":"checkout"}' | jget data.id)"
ENTRY="$(curl -s -X POST "$API/modules/$MODULE/entries" -H "$AUTH" -H "$JSON" \
  -d '{"key":"summary.title"}' | jget data.id)"
printf '  module %s · entry %s\n' "$MODULE" "$ENTRY"
check 409 "POST a second entry with the same key → 409" -- \
  -X POST "$API/modules/$MODULE/entries" -H "$AUTH" -H "$JSON" \
  -d '{"key":"summary.title"}'

step "05  The words, one PUT per language"
VALUE="$(curl -s -X PUT "$API/entries/$ENTRY/translations/en" -H "$AUTH" -H "$JSON" \
  -d '{"value":"Order summary"}' | jget data.id)"
curl -s -X PUT "$API/entries/$ENTRY/translations/ar" -H "$AUTH" -H "$JSON" \
  -d '{"value":"ملخص الطلب"}' >/dev/null
printf '  value %s (version 1)\n' "$VALUE"

# Someone else edits it, so the English value moves to version 2. The text has
# to actually differ: TypeORM's `save` diffs the loaded entity, so re-sending
# identical copy issues no UPDATE and `@VersionColumn` does not move.
check 200 "PUT different copy → version 2" -- \
  -X PUT "$API/entries/$ENTRY/translations/en" -H "$AUTH" -H "$JSON" \
  -d '{"value":"Your order","expectedVersion":1}'

# And now the first editor saves the copy they opened. Two editors on one key
# is the expected case, not the exotic one; the loser gets the current value
# back to diff rather than a silent overwrite.
check 409 "PUT with a now-stale expectedVersion:1 → 409" -- \
  -X PUT "$API/entries/$ENTRY/translations/en" -H "$AUTH" -H "$JSON" \
  -d '{"value":"Order total","expectedVersion":1}'

step "06  Publish, then read the history"
check 200 "POST /translations/:id/publish" -- \
  -X POST "$API/translations/$VALUE/publish" -H "$AUTH"
check 200 "GET /translations/:id/history" -- \
  "$API/translations/$VALUE/history" -H "$AUTH"

step "07  A service credential, and the bundle a client app actually fetches"
KEY="$(curl -s -X POST "$API/apps/$APP/api-keys" -H "$AUTH" -H "$JSON" \
  -d '{"name":"smoke test"}' | jget data.key)"
printf '  key %s… (returned exactly once)\n' "${KEY:0:12}"

BUNDLE_URL="$API/v1/apps/$APP_SLUG/locales/en"
check 200 "GET /v1/apps/:slug/locales/en with X-API-Key" -- \
  "$BUNDLE_URL" -H "X-API-Key: $KEY"
printf '  bundle: %s\n' "$(curl -s "$BUNDLE_URL" -H "X-API-Key: $KEY" | node -e '
  let raw = ""; process.stdin.on("data", (c) => (raw += c));
  process.stdin.on("end", () => process.stdout.write(JSON.stringify(JSON.parse(raw).data.bundle)));
')"

# The ETag is the releaseId. Sending it back is what keeps a client app's
# cold start off a full table read.
ETAG="$(curl -sI "$BUNDLE_URL" -H "X-API-Key: $KEY" | awk 'tolower($1)=="etag:"{print $2}' | tr -d '\r')"
check 304 "If-None-Match with the current ETag → 304, no body" -- \
  "$BUNDLE_URL" -H "X-API-Key: $KEY" -H "If-None-Match: $ETAG"

step "08  The invite flow — the only way a second person gets in"
INVITED="$(curl -s -X POST "$API/users" -H "$AUTH" -H "$JSON" \
  -d "{\"email\":\"smoke-editor-$RUN@example.test\",\"name\":\"Smoke Editor\",\"role\":\"editor\"}")"
INVITE_TOKEN="$(printf '%s' "$INVITED" | jget data.invitation.token)"
printf '  accept url %s\n' "$(printf '%s' "$INVITED" | jget data.invitation.acceptUrl)"

check 200 "GET /invitations/me with X-Invite-Token" -- \
  "$API/invitations/me" -H "X-Invite-Token: $INVITE_TOKEN"
check 401 "…and with no token at all" -- "$API/invitations/me"

EDITOR="$(curl -s -X POST "$API/invitations/accept" -H "$JSON" \
  -H "X-Invite-Token: $INVITE_TOKEN" \
  -d '{"password":"smoke-editor-password"}')"
EDITOR_TOKEN="$(printf '%s' "$EDITOR" | jget data.accessToken)"
printf '  accepted — signed in as %s\n' "$(printf '%s' "$EDITOR" | jget data.user.email)"

# Single use: the link in an old email thread is dead.
check 401 "POST /invitations/accept twice with one token → 401" -- \
  -X POST "$API/invitations/accept" -H "$JSON" \
  -H "X-Invite-Token: $INVITE_TOKEN" -d '{"password":"another-password-1"}'

step "09  Now break it on purpose"
check 401 "GET /apps with no Authorization header" -- "$API/apps"
# 403, never 401 — the dashboard logs people out on a 401, and this user is
# signed in fine, they just may not do this.
check 403 "POST /apps as an editor → 403, not 401" -- \
  -X POST "$API/apps" -H "Authorization: Bearer $EDITOR_TOKEN" -H "$JSON" \
  -d '{"name":"Nope","slug":"nope","defaultLocaleCode":"en"}'
check 403 "GET /users as an editor → 403" -- \
  "$API/users" -H "Authorization: Bearer $EDITOR_TOKEN"
check 401 "A CMS bearer token on a /v1/ runtime route" -- \
  "$BUNDLE_URL" -H "$AUTH"
check 401 "A revoked-looking key on the runtime route" -- \
  "$BUNDLE_URL" -H "X-API-Key: cms_deadbeef.not-a-real-key"
check 400 "GET /users/not-a-uuid → 400, not 500" -- \
  "$API/users/not-a-uuid" -H "$AUTH"

step "10  The last-admin guard"
# The seeded admin is usually the only active one, so this should refuse. With
# a second active admin it is allowed — that is the point, not a flaky check.
ME="$(curl -s "$API/auth/me" -H "$AUTH" | jget data.id)"
ADMIN_COUNT="$(curl -s "$API/users?role=admin&status=active&limit=100" -H "$AUTH" | jget data.meta.total)"
printf '  active admins: %s\n' "$ADMIN_COUNT"
if [ "$ADMIN_COUNT" = "1" ]; then
  check 422 "PATCH the last admin to editor → 422" -- \
    -X PATCH "$API/users/$ME" -H "$AUTH" -H "$JSON" -d '{"role":"editor"}'
else
  printf '  \033[33m~\033[0m more than one active admin, so demotion is allowed here — skipped\n'
fi
check 422 "POST /users/:me/disable → 422 (self-disable)" -- \
  -X POST "$API/users/$ME/disable" -H "$AUTH"

# ---------------------------------------------------------------------------

printf '\n\033[1mSummary\033[0m  %s passed, %s failed\n' "$pass" "$fail"
printf 'Created: app %s, module %s, entry %s, user smoke-editor-%s@example.test\n' \
  "$APP_SLUG" "checkout" "summary.title" "$RUN"
[ "$fail" -eq 0 ]
