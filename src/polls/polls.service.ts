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

// This is what gets sent to real-time subscribers when someone votes
export interface VoteEvent {
  pollId: string;
  results: any; // the updated poll results after the vote
}

@Injectable()
export class PollsService {
  private readonly logger = new Logger(PollsService.name);

  // This broadcasts vote events to anyone listening via Server-Sent Events
  // Think of it like a radio station that announces "hey, someone just voted!"
  public voteEvents$ = new Subject<VoteEvent>();

  constructor(
    @InjectRepository(Poll)
    private readonly pollRepository: Repository<Poll>,

    @InjectRepository(PollOption)
    private readonly optionRepository: Repository<PollOption>,

    @InjectRepository(Vote)
    private readonly voteRepository: Repository<Vote>,

    private readonly dataSource: DataSource,
    private readonly resultsService: ResultsService,
  ) {}

  /**
   * Creates a brand new poll with all its answer options
   *
   * We validate a few things first:
   * - Poll can't close in the past (that would be weird)
   * - All options must be unique (no point having "Yes" twice)
   *
   * Uses a database transaction so if anything fails, nothing gets saved
   */
  async createPoll(createPollDto: CreatePollDto): Promise<PollResponseDto> {
    this.logger.log(`Creating poll: ${createPollDto.question}`);

    // Make sure they're not trying to close the poll yesterday
    const closesAt = new Date(createPollDto.closesAt);
    if (closesAt <= new Date()) {
      throw new BadRequestException('Poll closing time must be in the future');
    }

    // Remove duplicate options - using Set to find unique values
    const uniqueOptions = [...new Set(createPollDto.options)];
    if (uniqueOptions.length !== createPollDto.options.length) {
      throw new BadRequestException('Poll options must be unique');
    }

    // Everything looks good, let's save it all in one transaction
    // If anything fails, the whole thing gets rolled back
    const result = await this.dataSource.transaction(async manager => {
      // First, create the poll itself
      const poll = manager.create(Poll, {
        question: createPollDto.question,
        closesAt,
        hideResultsUntilClose: createPollDto.hideResultsUntilClose || false,
      });

      const savedPoll = await manager.save(poll);

      // Now create all the answer options for this poll
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

    return this.transformPollForResponse(result);
  }

  /**
   * Gets a single poll by its ID
   *
   * Pretty straightforward - find it or throw a 404
   */
  async getPoll(pollId: string): Promise<PollResponseDto> {
    this.logger.log(`Fetching poll: ${pollId}`);

    const poll = await this.pollRepository.findOne({
      where: { id: pollId },
      relations: ['options'], // grab the options too
    });

    if (!poll) {
      throw new NotFoundException(`Poll with ID ${pollId} not found`);
    }

    return this.transformPollForResponse(poll);
  }

  /**
   * Let someone cast their vote in a poll
   *
   * This is where the magic happens. We check:
   * - Poll exists
   * - Poll is still open (not closed yet)
   * - The option they picked actually belongs to this poll
   * - They haven't voted before (database constraint handles this)
   *
   * If everything checks out, we save their vote and tell everyone about it!
   */
  async castVote(pollId: string, voteDto: VoteDto): Promise<{ message: string }> {
    this.logger.log(`User ${voteDto.userUuid} voting for option ${voteDto.optionId} in poll ${pollId}`);

    // First, make sure this poll exists and get its options
    const poll = await this.findPollWithOptions(pollId);

    // Check if voting time has passed
    this.validatePollIsOpen(poll);

    // Make sure they're voting for a real option in this poll
    this.validateOptionBelongsToPoll(poll, voteDto.optionId);

    try {
      // Save the vote in a transaction for safety
      await this.saveVoteInTransaction(pollId, voteDto);

      this.logger.log(`Vote cast successfully for poll ${pollId}`);

      // Clear any cached results since we have new data
      this.resultsService.invalidateCache(pollId);

      // Tell everyone listening that we got a new vote!
      this.broadcastVoteEvent(pollId);

      return { message: 'Vote cast successfully' };

    } catch (error) {
      return this.handleVoteError(error, voteDto.userUuid, pollId);
    }
  }

  /**
   * Get the current results for a poll
   *
   * Just makes sure the poll exists, then delegates to ResultsService
   * (Single Responsibility - we don't calculate results here)
   */
  async getPollResults(pollId: string) {
    // Quick check that this poll actually exists
    await this.validatePollExists(pollId);

    // Let the results service handle the complex calculations
    return this.resultsService.getPollResults(pollId);
  }

  // --- Private helper methods (the behind-the-scenes stuff) ---

  /**
   * Finds a poll and includes its options
   * Throws if not found - no need to return null and check everywhere
   */
  private async findPollWithOptions(pollId: string): Promise<Poll> {
    const poll = await this.pollRepository.findOne({
      where: { id: pollId },
      relations: ['options'],
    });

    if (!poll) {
      throw new NotFoundException(`Poll with ID ${pollId} not found`);
    }

    return poll;
  }

  /**
   * Quick existence check for a poll
   * Used when we just need to verify it exists but don't need the data
   */
  private async validatePollExists(pollId: string): Promise<void> {
    const poll = await this.pollRepository.findOne({ where: { id: pollId } });
    if (!poll) {
      throw new NotFoundException(`Poll with ID ${pollId} not found`);
    }
  }

  /**
   * Makes sure the poll hasn't closed yet
   * Nobody likes late voters! (Well, actually we just can't allow it)
   */
  private validatePollIsOpen(poll: Poll): void {
    if (new Date() >= poll.closesAt) {
      throw new UnprocessableEntityException('Poll has closed');
    }
  }

  /**
   * Verifies the option they want to vote for actually exists in this poll
   * Prevents people from voting for options from different polls
   */
  private validateOptionBelongsToPoll(poll: Poll, optionId: string): void {
    const option = poll.options.find(opt => opt.id === optionId);
    if (!option) {
      throw new NotFoundException(`Option with ID ${optionId} not found in this poll`);
    }
  }

  /**
   * Saves the vote safely in a database transaction
   * If this fails, nothing gets committed
   */
  private async saveVoteInTransaction(pollId: string, voteDto: VoteDto): Promise<void> {
    await this.dataSource.transaction(async manager => {
      const vote = manager.create(Vote, {
        userUuid: voteDto.userUuid,
        pollId: pollId,
        optionId: voteDto.optionId,
      });

      await manager.save(vote);
    });
  }

  /**
   * Handles errors when someone tries to vote
   * Mainly catches duplicate votes (someone voting twice)
   */
  private handleVoteError(error: any, userUuid: string, pollId: string): never {
    // Check if this is a "you already voted" error
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message.includes('UNIQUE constraint failed')) {
      this.logger.warn(`Duplicate vote attempt by user ${userUuid} for poll ${pollId}`);
      throw new ConflictException('User has already voted in this poll');
    }

    // Something else went wrong - log it and re-throw
    this.logger.error(`Error casting vote: ${error.message}`, error.stack);
    throw error;
  }

  /**
   * Tells everyone subscribed to real-time updates that we got a new vote
   * Gets the latest results and broadcasts them via Server-Sent Events
   */
  private async broadcastVoteEvent(pollId: string): Promise<void> {
    try {
      const results = await this.resultsService.getPollResults(pollId);
      this.voteEvents$.next({ pollId, results });
    } catch (error) {
      // Don't fail the vote if broadcasting fails - that would be annoying
      this.logger.error(`Error broadcasting vote event for poll ${pollId}: ${error.message}`);
    }
  }


  /**
   * Converts a Poll entity into the format our API returns
   * Keeps internal database structure separate from what users see
   */
  private transformPollForResponse(poll: Poll): PollResponseDto {
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