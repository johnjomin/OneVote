import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { PollsModule } from './polls/polls.module';
import { AppDataSource } from './data-source';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter, AllExceptionsFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    // Configure TypeORM with our data source
    TypeOrmModule.forRoot(AppDataSource.options),

    // Feature modules
    PollsModule,
  ],
  providers: [
    // Global logging interceptor for all HTTP requests
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },

    // Global exception filters for consistent error handling
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}