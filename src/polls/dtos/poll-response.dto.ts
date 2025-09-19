import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PollOptionResponseDto {
  @ApiProperty({
    description: 'Option ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Option text',
    example: 'JavaScript',
  })
  text: string;
}

export class PollResponseDto {
  @ApiProperty({
    description: 'Poll ID',
    example: '987fcdeb-51a2-43d1-b234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Poll question',
    example: 'What is your favorite programming language?',
  })
  question: string;

  @ApiProperty({
    description: 'Poll options',
    type: [PollOptionResponseDto],
  })
  options: PollOptionResponseDto[];

  @ApiProperty({
    description: 'When the poll closes (ISO timestamp)',
    example: '2024-12-31T23:59:59.000Z',
  })
  closesAt: string;

  @ApiProperty({
    description: 'Whether results are hidden until close',
  })
  hideResultsUntilClose: boolean;

  @ApiProperty({
    description: 'When the poll was created (ISO timestamp)',
    example: '2024-01-01T12:00:00.000Z',
  })
  createdAt: string;
}

export class OptionResultDto {
  @ApiProperty({
    description: 'Option ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  optionId: string;

  @ApiProperty({
    description: 'Option text',
    example: 'JavaScript',
  })
  text: string;

  @ApiProperty({
    description: 'Number of votes for this option',
    example: 15,
  })
  count: number;

  @ApiProperty({
    description: 'Percentage of total votes',
    example: 45.5,
  })
  percentage: number;
}

export class PollResultsDto {
  @ApiProperty({
    description: 'Total number of votes',
    example: 33,
  })
  total: number;

  @ApiProperty({
    description: 'Results per option',
    type: [OptionResultDto],
  })
  options: OptionResultDto[];

  @ApiProperty({
    description: 'Vote velocity (votes per minute) over last 5 minutes',
    example: 2.4,
  })
  voteVelocityPerMinLast5: number;
}