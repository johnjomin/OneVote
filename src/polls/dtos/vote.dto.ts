import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VoteDto {
  @ApiProperty({
    description: 'UUID of the poll option to vote for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsUUID()
  optionId: string;

  @ApiProperty({
    description: 'UUID identifying the user casting the vote',
    example: '987fcdeb-51a2-43d1-b234-567890abcdef',
  })
  @IsString()
  @IsUUID()
  userUuid: string;
}