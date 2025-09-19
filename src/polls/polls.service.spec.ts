import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PollsService } from './polls.service';
import { ResultsService } from './results/results.service';
import { Poll } from './entities/poll.entity';
import { PollOption } from './entities/poll-option.entity';
import { Vote } from './entities/vote.entity';

describe('PollsService', () => {
  let service: PollsService;
  let pollRepository: Repository<Poll>;
  let optionRepository: Repository<PollOption>;
  let voteRepository: Repository<Vote>;
  let resultsService: ResultsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PollsService,
        {
          provide: ResultsService,
          useValue: {
            getPollResults: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Poll), useValue: {} },
        { provide: getRepositoryToken(PollOption), useValue: {} },
        { provide: getRepositoryToken(Vote), useValue: {} },
      ],
    }).compile();

    service = module.get<PollsService>(PollsService);
    resultsService = module.get<ResultsService>(ResultsService);
    pollRepository = module.get(getRepositoryToken(Poll));
    optionRepository = module.get(getRepositoryToken(PollOption));
    voteRepository = module.get(getRepositoryToken(Vote));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(resultsService).toBeDefined();
    expect(pollRepository).toBeDefined();
    expect(optionRepository).toBeDefined();
    expect(voteRepository).toBeDefined();
  });
});
