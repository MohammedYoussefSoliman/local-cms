import { PaginationQueryDto } from '@/common';

/**
 * Adds nothing to the base. `search` is inherited and *is* wired — it matches
 * the entry key — so it is not an accepted-but-ignored parameter.
 */
export class ListDraftsQueryDto extends PaginationQueryDto {}
