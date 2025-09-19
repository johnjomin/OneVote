import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDataSource } from './data-source';

@Module({
  imports: [
    // Configure TypeORM with data source
    TypeOrmModule.forRoot(AppDataSource.options),
  ],
})
export class AppModule {}