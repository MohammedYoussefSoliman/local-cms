export type CreateApiKeyPayload = {
  /** What the key is for, e.g. "storefront web". */
  name: string;
};

export type ApiKeyResponseData = {
  id: string;
  appId: string;
  name: string;
  /**
   * The leading, non-secret segment of the key — the only thing that identifies
   * it once the plaintext is gone. Safe to log and safe to display.
   */
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdBy: string | null;
  createdAt: string;
};

/**
 * The create response, and the only response in the API that ever carries a
 * plaintext key. Only the hash is stored, so this cannot be re-issued — the
 * dashboard has to make the reader copy it before they navigate away.
 */
export type CreatedApiKeyResponseData = ApiKeyResponseData & {
  key: string;
};
