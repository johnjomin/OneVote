import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vote } from '../entities/vote.entity';
import { Poll } from '../entities/poll.entity';
import { PollResultsDto, OptionResultDto, HiddenResultsDto } from '../dtos/poll-response.dto';

// Simple in-memory cache with TTL
interface CacheEntry {
  data: PollResultsDto;
  timestamp: number; // when this was cached (milliseconds since epoch)
}

/**
 * Service responsible for calculating and caching poll results
 *
 * This is where the math happens! We count votes, calculate percentages,
 * figure out vote velocity, and cache everything so we don't hit the database
 * every time someone wants to see results.
 */
@Injectable()
export class ResultsService {
  private readonly logger = new Logger(ResultsService.name);

  // In-memory cache - stores results so we don't recalculate every time
  private readonly cache = new Map<string, CacheEntry>();

  // How long to keep cached results (default 10 seconds)
  private readonly cacheTtlMs = (parseInt(process.env.RESULTS_CACHE_TTL_SECONDS) || 10) * 1000;

  constructor(
    @InjectRepository(Vote)
    private readonly voteRepository: Repository<Vote>,

    @InjectRepository(Poll)
    private readonly pollRepository: Repository<Poll>,
  ) {}

  /**
   * Gets poll results - the main method everyone calls
   *
   * This method is like a smart "bouncer" at a club:
   * 1. First checks if the poll exists (no sneaking in!)
   * 2. Then checks if results should be hidden (some polls are secretive)
   * 3. Looks for cached results (why recalculate if we just did?)
   * 4. If no cache, calculates fresh results from the database
   * 5. Caches the new results for next time
   *
   * Returns either the actual results or a "hidden" message
   */
  async getPollResults(pollId: string): Promise<PollResultsDto | HiddenResultsDto> {
    // First, make sure this poll actually exists
    const poll = await this.findPollWithOptions(pollId);

    // Check if the poll owner wants to hide results until voting ends
    // (Some people like the suspense!)
    if (this.shouldHideResults(poll)) {
      this.logger.debug(`Results hidden for poll ${pollId} until ${poll.closesAt}`);
      return this.createHiddenResultsResponse(poll);
    }

    // Try to get results from our cache first (faster than database)
    const cachedResults = this.getCachedResults(pollId);
    if (cachedResults) {
      this.logger.debug(`Returning cached results for poll ${pollId}`);
      return cachedResults;
    }

    // No cache hit, so let's calculate fresh results
    const freshResults = await this.computeResults(poll);

    // Store these results in cache for next time
    this.setCachedResults(pollId, freshResults);

    return freshResults;
  }

  /**
   * Clears cached results for a poll
   *
   * Called whenever someone votes - we need fresh calculations!
   * Think of it like clearing your browser cache when a website updates
   */
  invalidateCache(pollId: string): void {
    this.cache.delete(pollId);
    this.logger.debug(`Cache invalidated for poll ${pollId}`);
  }

  // --- Private helper methods (the behind-the-scenes magic) ---

  /**
   * Finds a poll with its options, throws if not found
   * Better to fail fast than return null and check everywhere
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
   * Checks if poll results should be hidden from users
   * Some poll creators want to keep results secret until voting ends
   */
  private shouldHideResults(poll: Poll): boolean {
    const now = new Date();
    return poll.hideResultsUntilClose && now < poll.closesAt;
  }

  /**
   * Creates a "results are hidden" response
   * Tells users when they can see results
   */
  private createHiddenResultsResponse(poll: Poll): HiddenResultsDto {
    return {
      hidden: true,
      closesAt: poll.closesAt.toISOString(),
    };
  }

  /**
   * Does the heavy lifting - calculates all the poll statistics
   *
   * This is where we:
   * - Count up all the votes
   * - Calculate percentages
   * - Figure out how fast people are voting
   * - Time how long it takes (for performance monitoring)
   */
  private async computeResults(poll: Poll): Promise<PollResultsDto> {
    const startTime = Date.now();

    // Get all votes for this poll (with a fancy database query)
    const votes = await this.fetchAllVotesForPoll(poll.id);
    const totalVotes = votes.length;

    // Count how many votes each option got
    const voteCounts = this.countVotesByOption(poll, votes);

    // Build the results with percentages and everything
    const optionResults = this.buildOptionResults(poll, voteCounts, totalVotes);

    // Calculate how fast people are voting recently
    const voteVelocity = this.calculateVoteVelocity(votes);

    const computeTime = Date.now() - startTime;
    this.logger.debug(`Computed results for poll ${poll.id} in ${computeTime}ms`);

    return {
      total: totalVotes,
      options: optionResults,
      voteVelocityPerMinLast5: voteVelocity,
    };
  }

  /**
   * Fetches all votes for a poll from the database
   * Uses a join to get option info too (more efficient than separate queries)
   */
  private async fetchAllVotesForPoll(pollId: string): Promise<Vote[]> {
    return this.voteRepository
      .createQueryBuilder('vote')
      .leftJoinAndSelect('vote.option', 'option')
      .where('vote.pollId = :pollId', { pollId })
      .getMany();
  }

  /**
   * Counts how many votes each option received
   * Returns a map of optionId -> vote count
   */
  private countVotesByOption(poll: Poll, votes: Vote[]): Map<string, number> {
    // Start with zero votes for each option
    const voteCounts = new Map<string, number>();
    poll.options.forEach(option => voteCounts.set(option.id, 0));

    // Count up the actual votes
    votes.forEach(vote => {
      const currentCount = voteCounts.get(vote.optionId) || 0;
      voteCounts.set(vote.optionId, currentCount + 1);
    });

    return voteCounts;
  }

  /**
   * Builds the final option results with counts and percentages
   * Handles the math for converting counts to percentages
   */
  private buildOptionResults(
    poll: Poll,
    voteCounts: Map<string, number>,
    totalVotes: number
  ): OptionResultDto[] {
    return poll.options.map(option => {
      const count = voteCounts.get(option.id) || 0;
      const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;

      return {
        optionId: option.id,
        text: option.text,
        count,
        percentage: Math.round(percentage * 100) / 100, // Round to 2 decimals
      };
    });
  }

  /**
   * Calculates how many votes per minute in the last 5 minutes
   * Useful for seeing if a poll is "hot" right now
   */
  private calculateVoteVelocity(votes: Vote[]): number {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentVotes = votes.filter(vote => vote.createdAt >= fiveMinutesAgo);
    return Math.round((recentVotes.length / 5) * 100) / 100; // Round to 2 decimals
  }

  /**
   * Tries to get results from cache
   * Returns null if not cached or if the cache is stale
   */
  private getCachedResults(pollId: string): PollResultsDto | null {
    const entry = this.cache.get(pollId);
    if (!entry) {
      return null; // Not in cache
    }

    // Check if the cache entry is too old
    const isExpired = Date.now() - entry.timestamp > this.cacheTtlMs;
    if (isExpired) {
      this.cache.delete(pollId); // Clean up expired entry
      return null;
    }

    return entry.data; // Fresh cached data!
  }

  /**
   * Stores results in cache with current timestamp
   * Next time someone asks for these results, we can serve them instantly
   */
  private setCachedResults(pollId: string, results: PollResultsDto): void {
    this.cache.set(pollId, {
      data: results,
      timestamp: Date.now(), // Remember when we cached this
    });
  }

  /**
   * Spring cleaning for the cache
   *
   * Removes old cached entries that have expired.
   * Call this periodically to prevent memory leaks (though our cache
   * is pretty small, so it's not critical)
   */
  cleanupExpiredCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [pollId, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTtlMs) {
        this.cache.delete(pollId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }
}