import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import type { HTTPErrorResponse } from '@cms/contracts';

import type { Request, Response } from 'express';

type PostgresError = { code?: string; constraint?: string; detail?: string };

/**
 * One error shape for the whole API (`HTTPErrorResponse`), so the dashboard
 * has exactly one thing to parse.
 *
 * Unique-violation handling matters here: the schema leans on partial unique
 * indexes for its invariants, and a raw 500 would tell an editor nothing about
 * the duplicate key they just typed.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const { statusCode, message, error, fieldErrors, details } =
      this.normalize(exception);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: HTTPErrorResponse = {
      statusCode,
      message,
      error,
      ...(fieldErrors ? { fieldErrors } : {}),
      ...(details ? { details } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }

  private normalize(exception: unknown): {
    statusCode: number;
    message: string;
    error: string;
    fieldErrors?: Record<string, string[]>;
    details?: Record<string, unknown>;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return { statusCode: status, message: payload, error: exception.name };
      }

      const record = payload as {
        message?: string | string[];
        error?: string;
        fieldErrors?: Record<string, string[]>;
        details?: Record<string, unknown>;
      };

      return {
        statusCode: status,
        message: Array.isArray(record.message)
          ? record.message.join(', ')
          : (record.message ?? exception.message),
        error: record.error ?? exception.name,
        ...(record.fieldErrors ? { fieldErrors: record.fieldErrors } : {}),
        ...(record.details ? { details: record.details } : {}),
      };
    }

    if (exception instanceof QueryFailedError) {
      const driver = exception.driverError as PostgresError;

      // 23505 unique_violation — surfaces the constraint that actually failed.
      if (driver.code === '23505') {
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `A record with these values already exists (${driver.constraint ?? 'unique constraint'}).`,
          error: 'Conflict',
        };
      }

      // 23514 check_violation — a domain invariant, e.g. module scope.
      if (driver.code === '23514') {
        return {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: `The request violates a domain rule (${driver.constraint ?? 'check constraint'}).`,
          error: 'Unprocessable Entity',
        };
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    };
  }
}
