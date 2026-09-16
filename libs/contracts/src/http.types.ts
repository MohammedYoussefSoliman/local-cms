/**
 * The single response envelope for every endpoint. The API's
 * `ResponseInterceptor` produces it and the dashboard's axios interceptor
 * unwraps it — neither side may invent its own shape.
 */
export type HTTPResponseType<T> = {
  data: T;
  message: string | null;
  statusCode: number;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedList<T> = {
  records: T[];
  meta: PaginationMeta;
};

export type PaginationParams = {
  page?: number;
  limit?: number;
  search?: string;
};

/**
 * Error envelope produced by `HttpExceptionFilter`. `fieldErrors` maps a DTO
 * property to its validation messages so the dashboard can attach them to form
 * fields rather than dropping them into a toast.
 */
export type HTTPErrorResponse = {
  statusCode: number;
  message: string;
  error: string;
  fieldErrors?: Record<string, string[]>;
  path: string;
  timestamp: string;
};
