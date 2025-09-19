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

  describe('getPollResults', () => {
    it('should return computed results for visible poll', async () => {
      const pollId = 'poll1';
      const poll = {
        id: pollId,
        hideResultsUntilClose: false,
        closesAt: new Date(Date.now() - 1000),
        options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      } as unknown as Poll;

      (pollRepo.findOne as any).mockResolvedValue(poll);
      (voteRepo.find as any).mockResolvedValue([
        { pollId, optionId: 'a' },
        { pollId, optionId: 'a' },
        { pollId, optionId: 'b' },
      ] as Vote[]);

      const r1: any = await service.getPollResults(pollId);
      expect(r1.totalVotes).toBe(3);

      // mutate repo return; cache should still return old result
      (voteRepo.find as any).mockResolvedValue([
        { pollId, optionId: 'b' },
      ] as Vote[]);

      const r2: any = await service.getPollResults(pollId);
      expect(r2.totalVotes).toBe(3); // cached
    });

    it('should return hidden marker if poll hides results until close', async () => {
      const pollId = 'poll2';
      const future = new Date(Date.now() + 60_000);
      const poll = {
        id: pollId,
        hideResultsUntilClose: true,
        closesAt: future,
        options: [{ id: 'x', label: 'X' }],
      } as unknown as Poll;

      (pollRepo.findOne as any).mockResolvedValue(poll);

      const res: any = await service.getPollResults(pollId);
      expect(res.hidden).toBe(true);
    });
  });
});
