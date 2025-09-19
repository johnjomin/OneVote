import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Poll } from './poll.entity';
import { PollOption } from './poll-option.entity';

// Unique constraint to prevent duplicate votes per user per poll
@Index(['pollId', 'userUuid'], { unique: true })
@Entity('votes')
export class Vote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  userUuid: string;

  // Many votes belong to one poll
  @ManyToOne(() => Poll, (poll) => poll.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pollId' })
  poll: Poll;

  @Column()
  pollId: string;

  // Many votes belong to one option
  @ManyToOne(() => PollOption, (option) => option.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'optionId' })
  option: PollOption;

  @Column()
  optionId: string;

  @CreateDateColumn()
  createdAt: Date;
}