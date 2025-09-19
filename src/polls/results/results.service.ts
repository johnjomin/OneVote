import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vote } from '../entities/vote.entity';
import { Poll } from '../entities/poll.entity';
import { PollResultsDto, OptionResultDto, HiddenResultsDto } from '../dtos/poll-response.dto';

// Simple in-memory cache with TTL
interface CacheEntry {
  data: PollResultsDto;
  timestamp: number;
}

@Injectable()
export class ResultsService {
  private readonly logger = new Logger(ResultsService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = (parseInt(process.env.RESULTS_CACHE_TTL_SECONDS) || 10) * 1000;

  constructor(
    @InjectRepository(Vote)
    private voteRepository: Repository<Vote>,
    @InjectRepository(Poll)
    private pollRepository: Repository<Poll>,
  ) {}

  /**
   * Get poll results with optional caching
   * Returns hidden status if poll is configured to hide results until close
   */
  async getPollResults(pollId: string): Promise<PollResultsDto | HiddenResultsDto> {
    // Find the poll first to check visibility settings
    const poll = await this.pollRepository.findOne({
      where: { id: pollId },
      relations: ['options'],
    });

    if (!poll) {
      throw new Error('Poll not found');
    }

    // Check if results should be hidden
    const now = new Date();
    if (poll.hideResultsUntilClose && now < poll.closesAt) {
      this.logger.debug(`Results hidden for poll ${pollId} until ${poll.closesAt}`);
      return {
        hidden: true,
        closesAt: poll.closesAt.toISOString(),
      };
    }

    // Check cache first
    const cached = this.getCachedResults(pollId);
    if (cached) {
      this.logger.debug(`Returning cached results for poll ${pollId}`);
      return cached;
    }

    // Compute results from database
    const results = await this.computeResults(poll);

    // Cache the results
    this.setCachedResults(pollId, results);

    return results;
  }

  /**
   * Invalidate cache for a specific poll (called when new votes arrive)
   */
  invalidateCache(pollId: string): void {
    this.cache.delete(pollId);
    this.logger.debug(`Cache invalidated for poll ${pollId}`);
  }

  /**
   * Compute results from database - includes vote counts, percentages, and velocity
   */
  private async computeResults(poll: Poll): Promise<PollResultsDto> {
    const startTime = Date.now();

    // Get all votes for this poll with option info
    const votes = await this.voteRepository
      .createQueryBuilder('vote')
      .leftJoinAndSelect('vote.option', 'option')
      .where('vote.pollId = :pollId', { pollId: poll.id })
      .getMany();

    const totalVotes = votes.length;

    // Count votes per option
    const voteCounts = new Map<string, number>();
    poll.options.forEach(option => voteCounts.set(option.id, 0));

    votes.forEach(vote => {
      const currentCount = voteCounts.get(vote.optionId) || 0;
      voteCounts.set(vote.optionId, currentCount + 1);
    });

    // Build option results with percentages
    const optionResults: OptionResultDto[] = poll.options.map(option => {
      const count = voteCounts.get(option.id) || 0;
      const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;

      return {
        optionId: option.id,
        text: option.text,
        count,
        percentage: Math.round(percentage * 100) / 100, // Round to 2 decimal places
      };
    });

    // Calculate vote velocity (votes per minute over last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentVotes = votes.filter(vote => vote.createdAt >= fiveMinutesAgo);
    const voteVelocityPerMinLast5 = Math.round((recentVotes.length / 5) * 100) / 100;

    const computeTime = Date.now() - startTime;
    this.logger.debug(`Computed results for poll ${poll.id} in ${computeTime}ms`);

    return {
      total: totalVotes,
      options: optionResults,
      voteVelocityPerMinLast5,
    };
  }

  /**
   * Get cached results if they exist and are not expired
   */
  private getCachedResults(pollId: string): PollResultsDto | null {
    const entry = this.cache.get(pollId);
    if (!entry) {
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > this.cacheTtlMs;
    if (isExpired) {
      this.cache.delete(pollId);
      return null;
    }

    return entry.data;
  }

  /**
   * Cache results with current timestamp
   */
  private setCachedResults(pollId: string, results: PollResultsDto): void {
    this.cache.set(pollId, {
      data: results,
      timestamp: Date.now(),
    });
  }

  /**
   * Clean up expired cache entries (can be called periodically)
   */
  cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [pollId, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTtlMs) {
        this.cache.delete(pollId);
      }
    }
  }
}