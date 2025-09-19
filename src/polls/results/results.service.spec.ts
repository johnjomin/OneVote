import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResultsService } from './results.service';
import { Poll } from '../entities/poll.entity';
import { Vote } from '../entities/vote.entity';

describe('ResultsService', () => {
  let service: ResultsService;
  let pollRepo: jest.Mocked<Repository<Poll>>;
  let voteRepo: jest.Mocked<Repository<Vote>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResultsService,
        { provide: getRepositoryToken(Poll), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Vote), useValue: { find: jest.fn() } },
      ],
    }).compile();

    service = module.get<ResultsService>(ResultsService);
    pollRepo = module.get(getRepositoryToken(Poll));
    voteRepo = module.get(getRepositoryToken(Vote));
  });

  it('wires up', () => {
    expect(service).toBeDefined();
    expect(pollRepo.findOne).toBeDefined();
    expect(voteRepo.find).toBeDefined();
  });
});
