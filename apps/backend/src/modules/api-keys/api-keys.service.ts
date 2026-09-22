import { createHash, randomBytes } from 'node:crypto';

import { ApiKey } from '@cms/database';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import type {
  ApiKeyResponseData,
  CreatedApiKeyResponseData,
} from '@cms/contracts';

import { AppsService } from '../apps/apps.service';

import type { CreateApiKeyDto } from './dto/create-api-key.dto';

/**
 * `cms_` plus eight hex characters — twelve, which is what `prefix` stores. It
 * is the leading segment of the key itself, so an admin can match a prefix in a
 * log line to a row without the secret half ever appearing.
 */
const PREFIX_BYTES = 4;

/** 32 bytes of entropy, base64url-encoded. */
const SECRET_BYTES = 32;

/**
 * How stale `last_used_at` is allowed to get. Writing it on every request would
 * turn a cacheable read endpoint into a write on every hit; a minute's
 * resolution is plenty to answer "is anything still using this key".
 */
const TOUCH_INTERVAL_MS = 60_000;

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly keys: Repository<ApiKey>,
    private readonly apps: AppsService,
  ) {}

  /**
   * Not paginated, like the app-locale list and for the same reason: an app has
   * a handful of client applications, not a growing table (typeorm Rule 6 is
   * about the ones that grow). Revoked keys are included — the audit is the
   * point of keeping them.
   */
  async findAll(appId: string): Promise<ApiKeyResponseData[]> {
    await this.apps.findEntityOrFail(appId);

    const records = await this.keys.find({
      where: { appId },
      order: { createdAt: 'DESC' },
    });

    return records.map(toApiKeyResponse);
  }

  /**
   * The plaintext exists only in this method's return value. Nothing writes it
   * to a log, nothing stores it, and no later request can recover it.
   */
  async create(
    appId: string,
    dto: CreateApiKeyDto,
    userId: string,
  ): Promise<CreatedApiKeyResponseData> {
    await this.apps.findEntityOrFail(appId);

    const prefix = `cms_${randomBytes(PREFIX_BYTES).toString('hex')}`;
    const plaintext = `${prefix}.${randomBytes(SECRET_BYTES).toString('base64url')}`;

    const record = await this.keys.save(
      this.keys.create({
        appId,
        name: dto.name,
        prefix,
        keyHash: hashKey(plaintext),
        createdBy: userId,
      }),
    );

    return { ...toApiKeyResponse(record), key: plaintext };
  }

  /**
   * Revoke, not delete. The row keeps `last_used_at` and `created_by`, which is
   * what makes "who issued the key that was still being used last Tuesday"
   * answerable after the incident rather than during it.
   */
  async revoke(id: string): Promise<ApiKeyResponseData> {
    const record = await this.keys.findOne({ where: { id } });
    if (!record) throw new NotFoundException('API key not found.');

    // Idempotent: re-revoking keeps the original timestamp, because the first
    // revocation is the one that mattered.
    record.revokedAt ??= new Date();
    await this.keys.save(record);

    return toApiKeyResponse(record);
  }

  /**
   * Resolves a presented credential. Used by `ApiKeyGuard` and nothing else.
   *
   * The lookup is by hash against `uq_api_keys_key_hash`, so it is one indexed
   * equality — a presented key is never compared row by row.
   */
  async resolve(presented: string): Promise<ApiKey | null> {
    const record = await this.keys.findOne({
      where: { keyHash: hashKey(presented), revokedAt: IsNull() },
    });

    if (!record) return null;

    await this.touch(record);
    return record;
  }

  /**
   * A key belongs to exactly one app. This is the data-scope check auth Rule 7
   * puts in a service rather than on a decorator — there is no role to compare,
   * only which app the credential was issued for.
   */
  assertServesApp(apiKey: { appId: string }, appId: string): void {
    if (apiKey.appId !== appId) {
      throw new ForbiddenException(
        'This service credential was not issued for this application.',
      );
    }
  }

  private async touch(record: ApiKey): Promise<void> {
    const now = Date.now();
    const last = record.lastUsedAt?.getTime() ?? 0;
    if (now - last < TOUCH_INTERVAL_MS) return;

    const lastUsedAt = new Date(now);
    await this.keys.update({ id: record.id }, { lastUsedAt });
    record.lastUsedAt = lastUsedAt;
  }
}

/**
 * SHA-256, not argon2. A key is 32 bytes of uniform randomness rather than a
 * human-chosen password, so there is no dictionary to slow an attacker down
 * against — and this runs on the hot path of every runtime read, where argon2's
 * deliberate cost would be the endpoint's latency budget.
 */
function hashKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/**
 * Entities are never returned as-is (HTTP contract Rule 5) — and here that rule
 * is load-bearing rather than precautionary: `keyHash` is on the entity and must
 * never reach a response.
 */
function toApiKeyResponse(record: ApiKey): ApiKeyResponseData {
  return {
    id: record.id,
    appId: record.appId,
    name: record.name,
    prefix: record.prefix,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
  };
}
