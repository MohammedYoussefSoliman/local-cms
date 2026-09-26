import type { ModuleScope } from '@cms/domain';

/**
 * `scope` is deliberately absent, and so is `appId`. Both are decided by the
 * route the request arrived on — `/apps/:appId/modules` creates an app-scoped
 * module, `/modules/global` creates a global one — so there is no way for a
 * body to describe a combination `ck_modules_scope_app_id` would reject
 * (invariant Rule 2).
 */
export type CreateTranslationModulePayload = {
  name: string;
  slug: string;
  description?: string | null;
};

/**
 * `slug` is absent because it is part of the runtime path
 * (`/v1/apps/:appSlug/locales/:localeCode/modules/:moduleSlug`) and therefore
 * immutable once published (invariant Rule 8). `scope` is absent because
 * moving a namespace between an app and the global set is a content migration,
 * not a field edit.
 */
export type UpdateTranslationModulePayload = {
  name?: string;
  description?: string | null;
};

export type TranslationModuleResponseData = {
  id: string;
  /** `null` exactly when `scope` is `global` — the CHECK guarantees the pair. */
  appId: string | null;
  name: string;
  slug: string;
  scope: ModuleScope;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};
