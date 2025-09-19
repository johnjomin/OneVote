import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Poll } from './poll.entity';
import { Vote } from './vote.entity';

@Entity('poll_options')
export class PollOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  text: string;

  // Many options belong to one poll
  @ManyToOne(() => Poll, (poll) => poll.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pollId' })
  poll: Poll;

  @Column()
  pollId: string;

  // One option can have many votes
  @OneToMany(() => Vote, (vote) => vote.option)
  votes: Vote[];
}