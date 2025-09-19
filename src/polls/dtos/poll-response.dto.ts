import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PollOptionResponseDto {
  @ApiProperty({ description: 'Option ID', example: 'f9f4d6b1-1e3b-4f2f-8a6f-2a0a9d2f3e21' })
  id!: string;

  @ApiProperty({ description: 'Option text', example: 'JavaScript' })
  text!: string;
}

export class PollResponseDto {
  @ApiProperty({ description: 'Poll ID' })
  id!: string;

  @ApiProperty({ description: 'The question text' })
  question!: string;

  @ApiProperty({ description: 'ISO timestamp when the poll closes' })
  closesAt!: string;

  @ApiPropertyOptional({ description: 'Hide results until close', default: false })
  hideResultsUntilClose?: boolean;

  @ApiProperty({ type: [PollOptionResponseDto], description: 'Answer options' })
  options!: PollOptionResponseDto[];
}

export class OptionResultDto {
  @ApiProperty({ description: 'Option ID' })
  optionId!: string;

  @ApiProperty({ description: 'Option text' })
  text!: string;

  @ApiProperty({ description: 'Number of votes for this option', example: 5 })
  count!: number;

  @ApiProperty({ description: 'Percentage (0–100)', example: 62.5 })
  percentage!: number;
}

export class PollResultsResponseDto {
  @ApiProperty({ description: 'Poll ID' })
  pollId!: string;

  @ApiProperty({ description: 'Total number of votes across all options' })
  total!: number;

  @ApiProperty({ type: [OptionResultDto], description: 'Per-option breakdown' })
  options!: OptionResultDto[];

  @ApiProperty({ description: 'Votes per minute in the last 5 minutes', example: 2.4 })
  voteVelocityPerMinLast5!: number;
}

export class HiddenResultsDto {
  @ApiProperty({ description: 'If true, results are hidden because poll not closed yet' })
  hidden!: boolean;

  @ApiProperty({ description: 'When the poll will close (ISO)' })
  closesAt!: string;
}