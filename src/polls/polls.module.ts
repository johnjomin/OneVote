import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Poll } from './entities/poll.entity';
import { PollOption } from './entities/poll-option.entity';
import { ResultsStreamController } from './sse/results-stream.controller';
import { Vote } from './entities/vote.entity';

@Module({
  imports: [
    // Register entities with TypeORM
    TypeOrmModule.forFeature([Poll, PollOption, Vote]),
  ],
  controllers: [
    ResultsStreamController,
  ],
})
export class PollsModule {}