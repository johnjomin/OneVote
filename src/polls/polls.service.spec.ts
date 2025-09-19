import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { PollsService } from './polls.service';
import { ResultsService } from './results/results.service';
import { Poll } from './entities/poll.entity';
import { PollOption } from './entities/poll-option.entity';
import { Vote } from './entities/vote.entity';

describe('PollsService getPollResults()', () => {
  let service: PollsService;
  let pollRepository: jest.Mocked<Repository<Poll>>;
  let resultsService: jest.Mocked<ResultsService>;

  const poll = { id: 'p1', question: 'Q' } as Poll;
  const mockResults = {
    pollId: 'p1',
    totals: [
      { optionId: 'o1', text: 'A', votes: 3 },
      { optionId: 'o2', text: 'B', votes: 1 },
    ],
  };

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
        {
          provide: getRepositoryToken(Poll),
          useValue: {
            findOne: jest.fn(),
          },
        },
        { provide: getRepositoryToken(PollOption), useValue: {} },
        { provide: getRepositoryToken(Vote), useValue: {} },
      ],
    }).compile();

    service = module.get<PollsService>(PollsService);
    resultsService = module.get<ResultsService>(ResultsService);
    pollRepository = module.get(getRepositoryToken(Poll));
  });

  it('returns aggregated results for an existing poll', async () => {
    pollRepository.findOne.mockResolvedValue(poll);
    resultsService.getPollResults.mockResolvedValue(mockResults);

    const res = await service.getPollResults('p1');

    expect(pollRepository.findOne).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(resultsService.getPollResults).toHaveBeenCalledWith('p1');
    expect(res).toEqual(mockResults);
  });

  it('throws NotFound if poll does not exist', async () => {
    pollRepository.findOne.mockResolvedValue(null);
    await expect(service.getPollResults('missing')).rejects.toThrow(NotFoundException);
  });
});
