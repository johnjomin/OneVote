import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Interceptor for logging HTTP requests and responses
 * Logs request method, URL, and response time
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip } = request;
    const userAgent = request.get('User-Agent') || '';

    const now = Date.now();

    this.logger.log(`${method} ${url} - ${ip} - ${userAgent}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - now;
          this.logger.log(
            `${method} ${url} ${response.statusCode} - ${responseTime}ms`
          );
        },
        error: (error) => {
          const responseTime = Date.now() - now;
          this.logger.error(
            `${method} ${url} ${response.statusCode || 500} - ${responseTime}ms - ${error.message}`
          );
        },
      })
    );
  }
}