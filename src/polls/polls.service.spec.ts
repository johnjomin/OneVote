import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BadRequestException, NotFoundException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
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

  // A fake poll that we'll use in multiple tests
  // Think of this as our "test double" - looks real but it's just for testing
  const mockPoll = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    question: 'What is your favorite programming language?',
    closesAt: new Date(Date.now() + 86400000), // closes tomorrow (safe for testing)
    hideResultsUntilClose: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    options: [
      { id: 'option1', text: 'JavaScript', pollId: '123e4567-e89b-12d3-a456-426614174000' },
      { id: 'option2', text: 'TypeScript', pollId: '123e4567-e89b-12d3-a456-426614174000' },
    ],
  };

  // Mock database transaction - pretends to run code in a transaction
  const mockDataSource = {
    transaction: jest.fn(),
  };

  // Mock results service - we don't want to test that here
  const mockResultsService = {
    invalidateCache: jest.fn(), // pretends to clear cache
    getPollResults: jest.fn(),  // pretends to get results
  };

  // Set up our testing environment before each test
  // This creates a "mini NestJS app" just for testing
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PollsService, // the real service we're testing

        // Mock the Poll repository (fake database for polls)
        {
          provide: getRepositoryToken(Poll),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },

        // Mock the PollOption repository (fake database for options)
        {
          provide: getRepositoryToken(PollOption),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },

        // Mock the Vote repository (fake database for votes)
        {
          provide: getRepositoryToken(Vote),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },

        // Mock database connection
        {
          provide: DataSource,
          useValue: mockDataSource,
        },

        // Mock the results service
        {
          provide: ResultsService,
          useValue: mockResultsService,
        },
      ],
    }).compile();

    // Get references to everything we need for testing
    service = module.get<PollsService>(PollsService);
    pollRepository = module.get<Repository<Poll>>(getRepositoryToken(Poll));
    optionRepository = module.get<Repository<PollOption>>(getRepositoryToken(PollOption));
    voteRepository = module.get<Repository<Vote>>(getRepositoryToken(Vote));
    dataSource = module.get<DataSource>(DataSource);
    resultsService = module.get<ResultsService>(ResultsService);
  });

  // Clean up after each test so they don't interfere with each other
  afterEach(() => {
    jest.clearAllMocks(); // reset all our fake methods
  });

  // --- Testing poll creation ---
  describe('createPoll', () => {
    // A valid poll creation request that should work
    const validCreatePollDto: CreatePollDto = {
      question: 'What is your favorite programming language?',
      options: ['JavaScript', 'TypeScript'],
      closesAt: new Date(Date.now() + 86400000).toISOString(), // tomorrow
      hideResultsUntilClose: false,
    };

    it('should successfully create a poll with valid data', async () => {
      // Set up our fake database transaction
      const mockTransactionManager = {
        create: jest.fn().mockImplementation((entity, data) => ({ ...data, id: 'generated-id' })),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      };

      // Make our fake transaction actually call the callback
      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(mockTransactionManager);
      });

      // Try to create the poll
      const result = await service.createPoll(validCreatePollDto);

      // Check that everything worked as expected
      expect(result).toBeDefined();
      expect(result.question).toBe(validCreatePollDto.question);
      expect(mockDataSource.transaction).toHaveBeenCalled(); // should use a transaction
    });

    it('should reject polls that try to close in the past', async () => {
      // Create a poll that "closes yesterday" - this should fail
      const pastClosingTimeDto = {
        ...validCreatePollDto,
        closesAt: new Date(Date.now() - 86400000).toISOString(), // yesterday - oops!
      };

      // This should throw a BadRequestException
      await expect(service.createPoll(pastClosingTimeDto)).rejects.toThrow(BadRequestException);
    });

    it('should reject polls with duplicate options', async () => {
      // Someone accidentally put the same option twice
      const duplicateOptionsDto = {
        ...validCreatePollDto,
        options: ['JavaScript', 'JavaScript', 'TypeScript'], // "JavaScript" appears twice
      };

      // This should also throw a BadRequestException
      await expect(service.createPoll(duplicateOptionsDto)).rejects.toThrow(BadRequestException);
    });
  });

  // --- Testing getting a single poll ---
  describe('getPoll', () => {
    it('should return the poll when it exists', async () => {
      // Tell our fake repository to "find" the poll
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(mockPoll as Poll);

      // Try to get the poll
      const result = await service.getPoll(mockPoll.id);

      // Check that we got the right poll back
      expect(result).toBeDefined();
      expect(result.id).toBe(mockPoll.id);
      expect(result.question).toBe(mockPoll.question);
    });

    it('should throw NotFoundException when poll does not exist', async () => {
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(null);

      // This should throw a NotFoundException
      await expect(service.getPoll('nonexistent-poll-id')).rejects.toThrow(NotFoundException);
    });
  });

  // Testing the voting process
  describe('castVote', () => {
    // A valid vote that should work
    const validVoteDto: VoteDto = {
      optionId: 'option1',
      userUuid: 'user-123',
    };

    it('should successfully cast a vote when everything is valid', async () => {
      // Set up: poll exists and transaction works
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(mockPoll as Poll);

      const mockTransactionManager = {
        create: jest.fn().mockReturnValue({}),
        save: jest.fn().mockResolvedValue({}),
      };

      mockDataSource.transaction.mockImplementation(async (callback) => {
        return callback(mockTransactionManager);
      });

      // Cast the vote
      const result = await service.castVote(mockPoll.id, validVoteDto);

      // Check that everything worked
      expect(result.message).toBe('Vote cast successfully');
      expect(resultsService.invalidateCache).toHaveBeenCalledWith(mockPoll.id);
    });

    it('should reject votes for polls that don\'t exist', async () => {
      // Tell repository the poll doesn't exist
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(null);

      // This should throw NotFoundException
      await expect(service.castVote('nonexistent-poll', validVoteDto)).rejects.toThrow(NotFoundException);
    });

    it('should reject votes for polls that have already closed', async () => {
      // Create a poll that closed yesterday
      const closedPoll = {
        ...mockPoll,
        closesAt: new Date(Date.now() - 86400000), // closed yesterday
      };

      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(closedPoll as Poll);

      // This should throw UnprocessableEntityException
      await expect(service.castVote(mockPoll.id, validVoteDto)).rejects.toThrow(UnprocessableEntityException);
    });

    it('should reject votes for options that don\'t exist in the poll', async () => {
      // Try to vote for an option that doesn't exist
      const invalidVoteDto = { ...validVoteDto, optionId: 'nonexistent-option' };
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(mockPoll as Poll);

      // This should throw NotFoundException
      await expect(service.castVote(mockPoll.id, invalidVoteDto)).rejects.toThrow(NotFoundException);
    });

    it('should handle duplicate votes gracefully', async () => {
      // Someone tries to vote twice - database should prevent this
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(mockPoll as Poll);

      // Simulate the database saying "nope, you already voted"
      const duplicateVoteError = new Error('UNIQUE constraint failed');
      duplicateVoteError['code'] = 'SQLITE_CONSTRAINT_UNIQUE';

      mockDataSource.transaction.mockRejectedValue(duplicateVoteError);

      // This should throw ConflictException (not crash the app)
      await expect(service.castVote(mockPoll.id, validVoteDto)).rejects.toThrow(ConflictException);
    });
  });

  // --- Testing results retrieval ---
  describe('getPollResults', () => {
    it('should delegate to ResultsService when poll exists', async () => {
      // Set up: poll exists and results service has data
      const mockResults = {
        total: 42,
        options: [],
        voteVelocityPerMinLast5: 2.5
      };

      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(mockPoll as Poll);
      mockResultsService.getPollResults.mockResolvedValue(mockResults);

      // Get the results
      const result = await service.getPollResults(mockPoll.id);

      // Check that we got the results and called the right service
      expect(result).toBe(mockResults);
      expect(resultsService.getPollResults).toHaveBeenCalledWith(mockPoll.id);
    });

    it('should throw NotFoundException when poll does not exist', async () => {
      // Poll doesn't exist
      jest.spyOn(pollRepository, 'findOne').mockResolvedValue(null);

      // This should throw NotFoundException
      await expect(service.getPollResults('nonexistent-poll')).rejects.toThrow(NotFoundException);
    });
  });
});