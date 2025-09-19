import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
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
        { provide: ResultsService, useValue: { getPollResults: jest.fn() } },
        {
          provide: getRepositoryToken(Poll),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(PollOption),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        { provide: getRepositoryToken(Vote), useValue: {} },
      ],
    }).compile();

    service = module.get<PollsService>(PollsService);
    pollRepository = module.get(getRepositoryToken(Poll));
    optionRepository = module.get(getRepositoryToken(PollOption));
  });

  it('should throw if question is empty', async () => {
    const dto = { question: '', options: ['a', 'b'] } as CreatePollDto;
    await expect(service.createPoll(dto)).rejects.toThrow(BadRequestException);
  });

  it('should throw if less than 2 options', async () => {
    const dto = { question: 'Q', options: ['only-one'] } as CreatePollDto;
    await expect(service.createPoll(dto)).rejects.toThrow(BadRequestException);
  });

  it('should throw if options contain duplicates or blank', async () => {
    await expect(
      service.createPoll({ question: 'Q', options: ['x', 'x'] }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.createPoll({ question: 'Q', options: ['x', ''] }),
    ).rejects.toThrow(BadRequestException);
  });
});
