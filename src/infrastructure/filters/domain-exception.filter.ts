import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  DomainConflictError,
  DomainError,
  DomainForbiddenError,
  DomainNotFoundError,
  DomainUnauthorizedError,
  DomainValidationError,
} from '../../domain/errors/domain-errors.js';

/**
 * DomainExceptionFilter
 *
 * Catches any DomainError subclass thrown by use cases and maps it to
 * the appropriate HTTP status code + JSON body, keeping presentation-layer
 * knowledge (HTTP) out of the domain/application layers.
 *
 * Register as a global filter in AppModule via APP_FILTER provider.
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = this.toHttpStatus(exception);
    const message = exception.message;

    this.logger.warn(`[${exception.name}] ${message} → HTTP ${status}`);

    response.status(status).json({
      statusCode: status,
      error: exception.name,
      message,
    });
  }

  private toHttpStatus(err: DomainError): number {
    if (err instanceof DomainNotFoundError) return HttpStatus.NOT_FOUND;
    if (err instanceof DomainForbiddenError) return HttpStatus.FORBIDDEN;
    if (err instanceof DomainValidationError)
      return HttpStatus.UNPROCESSABLE_ENTITY;
    if (err instanceof DomainConflictError) return HttpStatus.CONFLICT;
    if (err instanceof DomainUnauthorizedError) return HttpStatus.UNAUTHORIZED;
    // Fallback for unknown DomainError subclasses
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
