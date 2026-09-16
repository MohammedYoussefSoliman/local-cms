import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, map } from 'rxjs';

import type { HTTPResponseType } from '@cms/contracts';

import type { Response } from 'express';

/**
 * Wraps every successful response in `HTTPResponseType<T>`. Controllers return
 * plain data and never build the envelope themselves — a hand-rolled envelope
 * in one controller is how the two sides drift.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  HTTPResponseType<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<HTTPResponseType<T>> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => ({
        data,
        message: null,
        statusCode: response.statusCode,
      })),
    );
  }
}
