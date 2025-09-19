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

describe('PollsService', () => {
  let service: PollsService;
  let pollRepository: jest.Mocked<Repository<Poll>>;
  let optionRepository: jest.Mocked<Repository<PollOption>>;
  let voteRepository: jest.Mocked<Repository<Vote>>;

  const poll = { id: 'p1', question: 'Q' } as Poll;
  const option = { id: 'o1', text: 'A', pollId: 'p1' } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PollsService,
        { provide: ResultsService, useValue: { getPollResults: jest.fn() } },
        {
          provide: getRepositoryToken(Poll),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(PollOption),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Vote),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PollsService>(PollsService);
    pollRepository = module.get(getRepositoryToken(Poll));
    optionRepository = module.get(getRepositoryToken(PollOption));
    voteRepository = module.get(getRepositoryToken(Vote));
  });

  it('should allow voting once and save vote', async () => {
    const dto: VoteDto = { pollId: 'p1', optionId: 'o1', voterId: 'u1' };

    pollRepository.findOne.mockResolvedValue(poll);
    optionRepository.findOne.mockResolvedValue(option);
    voteRepository.findOne.mockResolvedValue(null); // no prior vote
    voteRepository.create.mockImplementation((v: any) => v);
    voteRepository.save.mockImplementation(async (v: any) => ({ id: 'v1', ...v }));

    const result = await service.vote(dto);

    expect(pollRepository.findOne).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(optionRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'o1', pollId: 'p1' },
    });
    expect(voteRepository.findOne).toHaveBeenCalledWith({
      where: { pollId: 'p1', voterId: 'u1' },
    });
    expect(voteRepository.save).toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'v1', pollId: 'p1', optionId: 'o1', voterId: 'u1' });
  });
});
