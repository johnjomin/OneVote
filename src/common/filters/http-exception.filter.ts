import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';


// Global exception filter to handle HTTP exceptions
// Provides consistent error response format with helpful messages
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // Extract error details
    const exceptionResponse = exception.getResponse();
    const errorMessage = typeof exceptionResponse === 'string'
      ? exceptionResponse
      : (exceptionResponse as any).message || exception.message;

    const errorDetails = typeof exceptionResponse === 'object'
      ? exceptionResponse
      : { message: errorMessage };

    // Log the error
    this.logger.error(
      `HTTP Exception: ${request.method} ${request.url} - Status: ${status} - Message: ${errorMessage}`
    );

    // Send consistent error response
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ...errorDetails,
    };

    response.status(status).json(errorResponse);
  }
}


// Global exception filter for non-HTTP exceptions
// Handles unexpected errors and database constraint violations
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    // Handle specific database errors
    if (exception instanceof Error) {
      this.logger.error(
        `Unhandled Exception: ${request.method} ${request.url} - ${exception.message}`,
        exception.stack
      );

      // Handle SQLite constraint errors
      if (exception.message.includes('UNIQUE constraint failed')) {
        status = HttpStatus.CONFLICT;
        message = 'Duplicate entry - this action has already been performed';
      } else if (exception.message.includes('FOREIGN KEY constraint failed')) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid reference - related entity not found';
      }
    } else {
      this.logger.error(
        `Unknown Exception: ${request.method} ${request.url} - ${String(exception)}`
      );
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    };

    response.status(status).json(errorResponse);
  }
}