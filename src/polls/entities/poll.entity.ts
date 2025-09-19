import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PollOption } from './poll-option.entity';
import { Vote } from './vote.entity';


// The main Poll entity.
// Note: we keep relations simple and obvious. No magic.
@Entity('polls')
export class Poll {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500 })
  question: string;

  @Column({ type: 'datetime' })
  closesAt: Date;

  @Column({ type: 'boolean', default: false })
  hideResultsUntilClose: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // One poll has many options
  @OneToMany(() => PollOption, (option) => option.poll, {
    cascade: true,
    eager: true, // handy: return options with the poll by default
  })
  options: PollOption[];

  // One poll has many votes
  @OneToMany(() => Vote, (vote) => vote.poll)
  votes: Vote[];
}