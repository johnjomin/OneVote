import { DataSource } from 'typeorm';
import { Poll } from './polls/entities/poll.entity';
import { PollOption } from './polls/entities/poll-option.entity';
import { Vote } from './polls/entities/vote.entity';

// TypeORM configuration for SQLite database
export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: process.env.DATABASE_PATH || './onevote.sqlite',
  entities: [Poll, PollOption, Vote],
  synchronize: true, // Auto-create tables in development - use migrations in production
  logging: process.env.NODE_ENV === 'development',
});