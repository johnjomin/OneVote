import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Poll } from './entities/poll.entity';
import { PollOption } from './entities/poll-option.entity';
import { ResultsStreamController } from './sse/results-stream.controller';
import { Vote } from './entities/vote.entity';
import { PollsService } from './polls.service';
import { ResultsService } from './results/results.service';
import { PollsController } from './polls.controller';

@Module({
  imports: [
    // Register entities with TypeORM
    TypeOrmModule.forFeature([Poll, PollOption, Vote]),
  ],
  controllers: [
    PollsController,
    ResultsStreamController,
  ],
  providers: [
    PollsService,
    ResultsService,
  ],
})
export class PollsModule {}