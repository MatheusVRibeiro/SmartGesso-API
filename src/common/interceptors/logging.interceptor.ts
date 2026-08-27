import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Sensitive fields that should never be logged
const SENSITIVE_FIELDS = [
  'password',
  'senha',
  'token',
  'accessToken',
  'refreshToken',
  'refresh',
  'secret',
  'authorization',
];

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // Get or generate requestId
    const requestId =
      (request as any).requestId || request.headers['x-request-id'] || uuidv4();

    // Extract user and company info from request
    const userId = (request as any).user?.id || (request as any).userId;
    const companyId =
      (request as any).company?.id || (request as any).companyId;

    // Get route info
    const route = request.route?.path || request.url;
    const method = request.method;

    // Clean sensitive data from request body
    const sanitizedBody = this.sanitizeData(request.body);

    return next.handle().pipe(
      tap((_responseBody) => {
        const durationMs = Date.now() - startTime;
        const statusCode = response.statusCode;

        const logData = {
          requestId,
          userId,
          companyId,
          route,
          method,
          statusCode,
          durationMs,
          timestamp: new Date().toISOString(),
          // Only log body in development for debugging
          ...(process.env.NODE_ENV === 'development' && {
            requestBody: sanitizedBody,
          }),
        };

        console.log(JSON.stringify(logData));
      }),
      catchError((error) => {
        const durationMs = Date.now() - startTime;
        const statusCode = error.status || 500;
        const errorCode = error.code || error.name || 'INTERNAL_ERROR';

        const logData = {
          requestId,
          userId,
          companyId,
          route,
          method,
          statusCode,
          durationMs,
          errorCode,
          timestamp: new Date().toISOString(),
          ...(process.env.NODE_ENV === 'development' && {
            errorMessage: error.message,
            requestBody: sanitizedBody,
          }),
        };

        console.error(JSON.stringify(logData));
        throw error;
      }),
    );
  }

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };

    for (const field of SENSITIVE_FIELDS) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Handle nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  }
}
