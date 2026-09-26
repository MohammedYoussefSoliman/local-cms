import { Locale } from '@cms/database';
import { canonicalizeLocaleCode } from '@cms/domain';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import type { LocaleResponseData, PaginatedList } from '@cms/contracts';

import type { CreateLocaleDto } from './dto/create-locale.dto';
import type { ListLocalesQueryDto } from './dto/list-locales.query.dto';
import type { UpdateLocaleDto } from './dto/update-locale.dto';

/**
 * The whole point of this module: adding a language is an INSERT here, not a
 * migration and not a TypeScript change (invariant Rule 1).
 */
@Injectable()
export class LocalesService {
  constructor(
    @InjectRepository(Locale)
    private readonly locales: Repository<Locale>,
  ) {}

  async findAll(
    query: ListLocalesQueryDto,
  ): Promise<PaginatedList<LocaleResponseData>> {
    const search = query.search?.trim();
    const match = search ? ILike(`%${search}%`) : undefined;

    const [records, total] = await this.locales.findAndCount({
      // An array of conditions is OR'd. Undefined `match` means no filter.
      where: match
        ? [{ code: match }, { name: match }, { nativeName: match }]
        : {},
      take: query.limit,
      skip: (query.page - 1) * query.limit,
      // Alphabetical by code, not by creation date: this is a reference table
      // a human scans, and `fr` landing at the bottom because it was added
      // last is not what anyone is looking for.
      order: { code: 'ASC' },
    });

    return {
      records: records.map(toLocaleResponse),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Resolves the `:localeCode` segment other features route on. Returns the
   * entity rather than a response shape because the caller is another service,
   * not a controller — nothing here reaches the HTTP boundary.
   *
   * Canonicalized first, so a request for `PT-br` finds the `pt-BR` row instead
   * of 404ing on a casing difference.
   */
  findEntityByCode(code: string): Promise<Locale | null> {
    return this.locales.findOne({
      where: { code: canonicalizeLocaleCode(code) },
    });
  }

  /**
   * Every active language, as codes. Unbounded on purpose and safe to be so:
   * `locales` is a reference table bounded by the number of languages the CMS
   * knows about, not by content (typeorm Rule 6 is about the tables that grow).
   */
  async findActiveCodes(): Promise<string[]> {
    const records = await this.locales.find({
      where: { isActive: true },
      select: { code: true },
      order: { code: 'ASC' },
    });

    return records.map((locale) => locale.code);
  }

  async create(dto: CreateLocaleDto): Promise<LocaleResponseData> {
    // No `findOne` first. `uq_locales_code` is the check, and
    // HttpExceptionFilter turns its 23505 into a 409 — a pre-check is a race
    // two concurrent requests both win (typeorm Rule 5).
    const locale = await this.locales.save(
      this.locales.create({
        ...dto,
        code: canonicalizeLocaleCode(dto.code),
      }),
    );

    return toLocaleResponse(locale);
  }

  async update(id: string, dto: UpdateLocaleDto): Promise<LocaleResponseData> {
    const locale = await this.locales.findOne({ where: { id } });
    if (!locale) throw new NotFoundException('Locale not found.');

    // Assigned field by field rather than with Object.assign, so an optional
    // property the client omitted cannot overwrite a stored value with
    // undefined — and so `code` has nowhere to sneak in.
    if (dto.name !== undefined) locale.name = dto.name;
    if (dto.nativeName !== undefined) locale.nativeName = dto.nativeName;
    if (dto.direction !== undefined) locale.direction = dto.direction;
    if (dto.isActive !== undefined) locale.isActive = dto.isActive;

    return toLocaleResponse(await this.locales.save(locale));
  }
}

/**
 * Entities are never returned as-is (HTTP contract Rule 5). `Locale` is
 * harmless today, but the mapping is what stops a column added later from
 * appearing in the API by accident.
 */
function toLocaleResponse(locale: Locale): LocaleResponseData {
  return {
    id: locale.id,
    code: locale.code,
    name: locale.name,
    nativeName: locale.nativeName,
    direction: locale.direction,
    isActive: locale.isActive,
  };
}
