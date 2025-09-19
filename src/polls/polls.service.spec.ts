import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PollsService } from './polls.service';
import { ResultsService } from './results/results.service';
import { Poll } from './entities/poll.entity';
import { PollOption } from './entities/poll-option.entity';
import { Vote } from './entities/vote.entity';
import { CreatePollDto } from './dtos/create-poll.dto';
import { VoteDto } from './dtos/vote.dto';

describe('PollsService', () => {
  let service: PollsService;
  let pollRepository: Repository<Poll>;
  let optionRepository: Repository<PollOption>;
  let voteRepository: Repository<Vote>;
  let dataSource: DataSource;
  let resultsService: ResultsService;

  const mockPoll = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    question: 'Test poll?',
    closesAt: new Date(Date.now() + 86400000), // 1 day from now
    hideResultsUntilClose: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    options: [
      { id: 'option1', text: 'Option 1', pollId: '123e4567-e89b-12d3-a456-426614174000' },
      { id: 'option2', text: 'Option 2', pollId: '123e4567-e89b-12d3-a456-426614174000' },
    ],
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockResultsService = {
    invalidateCache: jest.fn(),
    getPollResults: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PollsService,
        {
          provide: getRepositoryToken(Poll),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PollOption),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Vote),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ResultsService,
          useValue: mockResultsService,
        },
      ],
    }).compile();

    service = module.get<PollsService>(PollsService);
    pollRepository = module.get<Repository<Poll>>(getRepositoryToken(Poll));
    optionRepository = module.get<Repository<PollOption>>(getRepositoryToken(PollOption));
    voteRepository = module.get<Repository<Vote>>(getRepositoryToken(Vote));
    dataSource = module.get<DataSource>(DataSource);
    resultsService = module.get<ResultsService>(ResultsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPoll', () => {
    const createPollDto: CreatePollDto = {
      question: 'Test poll?',
      options: ['Option 1', 'Option 2'],
      closesAt: new Date(Date.now() + 86400000).toISOString(),
      hideResultsUntilClose: false,
    };

    it('should create a poll successfully', async () => {
      const mockManager = {
        create: jest.fn().mockImplementation((entity, data) => ({ ...data, id: 'mock-id' })),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };

      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(mockManager);
      });

      const result = await service.createPoll(createPollDto);

      expect(result).toBeDefined();
      expect(result.question).toBe(createPollDto.question);
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException for past closing time', async () => {
      const pastCloseDto = {
        ...createPollDto,
        closesAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      };

      await expect(service.createPoll(pastCloseDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate options', async () => {
      const duplicateOptionsDto = {
        ...createPollDto,
        options: ['Option 1', 'Option 1', 'Option 2'],
      };

      await expect(service.createPoll(duplicateOptionsDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPoll', () => {
    it('should return poll when found', async () => {
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(mockPoll as Poll);

      const result = await service.getPoll(mockPoll.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockPoll.id);
      expect(result.question).toBe(mockPoll.question);
    });

    it('should throw NotFoundException when poll not found', async () => {
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getPoll('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('castVote', () => {
    const voteDto: VoteDto = {
      optionId: 'option1',
      userUuid: 'user123',
    };

    it('should cast vote successfully', async () => {
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(mockPoll as Poll);

      const mockManager = {
        create: jest.fn().mockReturnValue({}),
        save: jest.fn().mockResolvedValue({}),
      };

      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(mockManager);
      });

      const result = await service.castVote(mockPoll.id, voteDto);

      expect(result.message).toBe('Vote cast successfully');
      expect(resultsService.invalidateCache).toHaveBeenCalledWith(mockPoll.id);
    });

    it('should throw NotFoundException for nonexistent poll', async () => {
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(null);

      await expect(service.castVote('nonexistent', voteDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw UnprocessableEntityException for closed poll', async () => {
      const closedPoll = {
        ...mockPoll,
        closesAt: new Date(Date.now() - 86400000), // 1 day ago
      };

      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(closedPoll as Poll);

      await expect(service.castVote(mockPoll.id, voteDto)).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw NotFoundException for invalid option', async () => {
      const invalidVoteDto = { ...voteDto, optionId: 'invalid-option' };
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(mockPoll as Poll);

      await expect(service.castVote(mockPoll.id, invalidVoteDto)).rejects.toThrow(NotFoundException);
    });

    it('should handle duplicate vote constraint violation', async () => {
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(mockPoll as Poll);

      const duplicateError = new Error('UNIQUE constraint failed');
      duplicateError['code'] = 'SQLITE_CONSTRAINT_UNIQUE';

      mockDataSource.transaction.mockRejectedValue(duplicateError);

      await expect(service.castVote(mockPoll.id, voteDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('getPollResults', () => {
    it('should delegate to ResultsService', async () => {
      const mockResults = { total: 10, options: [], voteVelocityPerMinLast5: 2 };
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(mockPoll as Poll);
      mockResultsService.getPollResults.mockResolvedValue(mockResults);

      const result = await service.getPollResults(mockPoll.id);

      expect(result).toBe(mockResults);
      expect(resultsService.getPollResults).toHaveBeenCalledWith(mockPoll.id);
    });

    it('should throw NotFoundException for nonexistent poll', async () => {
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getPollResults('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});