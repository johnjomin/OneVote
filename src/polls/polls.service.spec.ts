import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PollsService } from './polls.service';
import { ResultsService } from './results/results.service';
import { Poll } from './entities/poll.entity';
import { PollOption } from './entities/poll-option.entity';
import { Vote } from './entities/vote.entity';
import { CreatePollDto } from './dtos/create-poll.dto';

describe('PollsService', () => {
  let service: PollsService;
  let pollRepository: jest.Mocked<Repository<Poll>>;
  let optionRepository: jest.Mocked<Repository<PollOption>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PollsService,
        {
          provide: ResultsService,
          useValue: { getPollResults: jest.fn() },
        },
        {
          provide: getRepositoryToken(Poll),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
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
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<PollsService>(PollsService);
    pollRepository = module.get(getRepositoryToken(Poll));
    optionRepository = module.get(getRepositoryToken(PollOption));
  });

  it('should create a poll with options', async () => {
    const dto: CreatePollDto = {
      question: 'Best JS runtime?',
      options: ['Node', 'Deno'],
    };

    const savedPoll = { id: 'p1', question: dto.question } as Poll;

    pollRepository.create.mockReturnValue({ question: dto.question } as any);
    pollRepository.save.mockResolvedValue(savedPoll);

    optionRepository.create.mockImplementation((data: any) => data);
    optionRepository.save.mockImplementation(async (opt: any) => ({
      id: `opt-${opt.text}`,
      ...opt,
    }));

    const result = await service.createPoll(dto);

    expect(pollRepository.create).toHaveBeenCalledWith({ question: dto.question });
    expect(pollRepository.save).toHaveBeenCalled();
    expect(optionRepository.create).toHaveBeenCalledTimes(2);
    expect(optionRepository.save).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      id: 'p1',
      question: dto.question,
    });
  });
});
