import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PollsService } from './polls.service';
import { ResultsService } from './results/results.service';
import { Poll } from './entities/poll.entity';
import { PollOption } from './entities/poll-option.entity';
import { Vote } from './entities/vote.entity';
import { VoteDto } from './dtos/vote.dto';

describe('PollsService vote()', () => {
  let service: PollsService;
  let pollRepository: jest.Mocked<Repository<Poll>>;
  let optionRepository: jest.Mocked<Repository<PollOption>>;
  let voteRepository: jest.Mocked<Repository<Vote>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PollsService,
        { provide: ResultsService, useValue: { getPollResults: jest.fn() } },
        { provide: getRepositoryToken(Poll), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(PollOption), useValue: { findOne: jest.fn() } },
        {
          provide: getRepositoryToken(Vote),
          useValue: { findOne: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PollsService>(PollsService);
    pollRepository = module.get(getRepositoryToken(Poll));
    optionRepository = module.get(getRepositoryToken(PollOption));
    voteRepository = module.get(getRepositoryToken(Vote));
  });

  it('throws NotFound if poll does not exist', async () => {
    pollRepository.findOne.mockResolvedValue(null);
    const dto: VoteDto = { pollId: 'missing', optionId: 'o1', voterId: 'u1' };
    await expect(service.vote(dto)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFound if option not in poll', async () => {
    pollRepository.findOne.mockResolvedValue({ id: 'p1' } as Poll);
    optionRepository.findOne.mockResolvedValue(null);
    const dto: VoteDto = { pollId: 'p1', optionId: 'bad', voterId: 'u1' };
    await expect(service.vote(dto)).rejects.toThrow(NotFoundException);
  });

  it('throws Conflict if voter already voted in poll', async () => {
    pollRepository.findOne.mockResolvedValue({ id: 'p1' } as Poll);
    optionRepository.findOne.mockResolvedValue({ id: 'o1', pollId: 'p1' } as any);
    voteRepository.findOne.mockResolvedValue({ id: 'v-old' } as Vote);
    const dto: VoteDto = { pollId: 'p1', optionId: 'o1', voterId: 'u1' };
    await expect(service.vote(dto)).rejects.toThrow(ConflictException);
  });
});
