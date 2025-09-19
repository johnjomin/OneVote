import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Poll } from './entities/poll.entity';
import { PollOption } from './entities/poll-option.entity';
import { Vote } from './entities/vote.entity';
import { CreatePollDto } from './dtos/create-poll.dto';
import { VoteDto } from './dtos/vote.dto';
import { PollResponseDto } from './dtos/poll-response.dto';
import { ResultsService } from './results/results.service';
import { Subject } from 'rxjs';

// Event for SSE notifications
export interface VoteEvent {
  pollId: string;
  results: any;
}

@Injectable()
export class PollsService {
  private readonly logger = new Logger(PollsService.name);

  // Subject for broadcasting vote events to SSE clients
  public voteEvents$ = new Subject<VoteEvent>();

  constructor(
    @InjectRepository(Poll)
    private pollRepository: Repository<Poll>,
    
    @InjectRepository(Vote)
    private dataSource: DataSource,
    private resultsService: ResultsService,
  ) {}

  /*
   Create a new poll with options
   Validates that closesAt is in the future and options are unique
   */
  async createPoll(createPollDto: CreatePollDto): Promise<PollResponseDto> {
    this.logger.log(`Creating poll: ${createPollDto.question}`);

    // Validate closesAt is in the future
    const closesAt = new Date(createPollDto.closesAt);
    if (closesAt <= new Date()) {
      throw new BadRequestException('Poll closing time must be in the future');
    }

    // Validate unique options
    const uniqueOptions = [...new Set(createPollDto.options)];
    if (uniqueOptions.length !== createPollDto.options.length) {
      throw new BadRequestException('Poll options must be unique');
    }

    // Create poll with options in a transaction
    const result = await this.dataSource.transaction(async manager => {
      // Create the poll
      const poll = manager.create(Poll, {
        question: createPollDto.question,
        closesAt,
        hideResultsUntilClose: createPollDto.hideResultsUntilClose || false,
      });

      const savedPoll = await manager.save(poll);

      // Create poll options
      const options = createPollDto.options.map(optionText =>
        manager.create(PollOption, {
          text: optionText,
          poll: savedPoll,
          pollId: savedPoll.id,
        })
      );

      const savedOptions = await manager.save(options);
      savedPoll.options = savedOptions;

      return savedPoll;
    });

    this.logger.log(`Created poll ${result.id} with ${result.options.length} options`);

    return this.mapPollToResponse(result);
  }

   /*
    Cast a vote for a poll option
    Uses transaction and unique constraint to prevent duplicate votes
   */
  async castVote(pollId: string, voteDto: VoteDto): Promise<{ message: string }> {
    this.logger.log(`User ${voteDto.userUuid} voting for option ${voteDto.optionId} in poll ${pollId}`);

    // Find poll and verify it exists and is open
    const poll = await this.pollRepository.findOne({
      where: { id: pollId },
      relations: ['options'],
    });

    if (!poll) {
      throw new NotFoundException(`Poll with ID ${pollId} not found`);
    }

    // Check if poll is still open
    if (new Date() >= poll.closesAt) {
      throw new UnprocessableEntityException('Poll has closed');
    }

    // Verify the option belongs to this poll
    const option = poll.options.find(opt => opt.id === voteDto.optionId);
    if (!option) {
      throw new NotFoundException(`Option with ID ${voteDto.optionId} not found in this poll`);
    }

    try {
      // Use transaction to ensure consistency
      await this.dataSource.transaction(async manager => {
        const vote = manager.create(Vote, {
          userUuid: voteDto.userUuid,
          pollId: pollId,
          optionId: voteDto.optionId,
        });

        await manager.save(vote);
      });

      this.logger.log(`Vote cast successfully for poll ${pollId}`);

      // Invalidate cache for this poll
      this.resultsService.invalidateCache(pollId);

      // Broadcast vote event for SSE
      this.broadcastVoteEvent(pollId);

      return { message: 'Vote cast successfully' };

    } 
    catch (error) {
      // Handle duplicate vote constraint violation
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message.includes('UNIQUE constraint failed')) {
        this.logger.warn(`Duplicate vote attempt by user ${voteDto.userUuid} for poll ${pollId}`);
        throw new ConflictException('User has already voted in this poll');
      }

      this.logger.error(`Error casting vote: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Get poll results (delegates to ResultsService)
  async getPollResults(pollId: string) {
    // Verify poll exists
    const poll = await this.pollRepository.findOne({ where: { id: pollId } });
    if (!poll) {
      throw new NotFoundException(`Poll with ID ${pollId} not found`);
    }

    return this.resultsService.getPollResults(pollId);
  }

  
  // Broadcast vote event to SSE subscribers
  private async broadcastVoteEvent(pollId: string): Promise<void> {
    try {
      const results = await this.resultsService.getPollResults(pollId);
      this.voteEvents$.next({ pollId, results });
    } catch (error) {
      this.logger.error(`Error broadcasting vote event for poll ${pollId}: ${error.message}`);
    }
  }


  // Map Poll entity to response DTO
  private mapPollToResponse(poll: Poll): PollResponseDto {
    return {
      id: poll.id,
      question: poll.question,
      options: poll.options.map(option => ({
        id: option.id,
        text: option.text,
      })),
      closesAt: poll.closesAt.toISOString(),
      hideResultsUntilClose: poll.hideResultsUntilClose,
      createdAt: poll.createdAt.toISOString(),
    };
  }
}