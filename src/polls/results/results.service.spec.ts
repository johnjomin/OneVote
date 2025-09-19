import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResultsService } from './results.service';
import { Poll } from '../entities/poll.entity';
import { Vote } from '../entities/vote.entity';

describe('ResultsService', () => {
  let service: ResultsService;
  let pollRepository: Repository<Poll>;
  let voteRepository: Repository<Vote>;

  const mockPoll = {
    id: 'poll123',
    question: 'Test poll?',
    closesAt: new Date(Date.now() + 86400000), // 1 day from now
    hideResultsUntilClose: false,
    options: [
      { id: 'option1', text: 'Option 1' },
      { id: 'option2', text: 'Option 2' },
    ],
  };

  const mockVotes = [
    { id: 'vote1', optionId: 'option1', createdAt: new Date() },
    { id: 'vote2', optionId: 'option1', createdAt: new Date() },
    { id: 'vote3', optionId: 'option2', createdAt: new Date() },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResultsService,
        {
          provide: getRepositoryToken(Poll),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Vote),
          useValue: {
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              getMany: jest.fn(),
            })),
          },
        },
      ],
    }).compile();

    service = module.get<ResultsService>(ResultsService);
    pollRepository = module.get<Repository<Poll>>(getRepositoryToken(Poll));
    voteRepository = module.get<Repository<Vote>>(getRepositoryToken(Vote));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPollResults', () => {
    it('should return computed results for visible poll', async () => {
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(mockPoll as Poll);

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockVotes),
      };

      jest.spyOn(voteRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.getPollResults('poll123');

      expect(result).toHaveProperty('total', 3);
      expect(result).toHaveProperty('options');
      expect(result).toHaveProperty('voteVelocityPerMinLast5');
      expect((result as any).options).toHaveLength(2);
    });

    it('should return hidden status for polls with hidden results', async () => {
      const hiddenPoll = {
        ...mockPoll,
        hideResultsUntilClose: true,
      };

      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(hiddenPoll as Poll);

      const result = await service.getPollResults('poll123');

      expect(result).toHaveProperty('hidden', true);
      expect(result).toHaveProperty('closesAt');
    });

    it('should throw error for nonexistent poll', async () => {
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getPollResults('nonexistent')).rejects.toThrow('Poll not found');
    });
  });

  describe('cache management', () => {
    it('should invalidate cache for specific poll', () => {
      // This test verifies the cache invalidation method doesn't throw
      expect(() => service.invalidateCache('poll123')).not.toThrow();
    });

    it('should clean up expired cache entries', () => {
      // This test verifies the cleanup method doesn't throw
      expect(() => service.cleanupExpiredCache()).not.toThrow();
    });
  });
});