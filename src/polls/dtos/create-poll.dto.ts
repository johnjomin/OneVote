import { IsString, IsArray, IsDateString, IsOptional, IsBoolean, ArrayMinSize, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePollDto {
  @ApiProperty({
    description: 'The poll question people will answer',
    example: 'What is your favorite programming language?',
  })
  @IsString()
  @MinLength(1, { message: 'question must not be empty' })
  @MaxLength(300, { message: 'question is too long (max 300 chars)' })
  question!: string;

  @ApiProperty({
    description: 'List of answer options (need at least 2)',
    example: ['JavaScript', 'Python', 'Go'],
  })
  @IsArray()
  @ArrayMinSize(2, { message: 'please provide at least two options' })
  @IsString({ each: true, message: 'each option must be a string' })
  options!: string[];

  @ApiProperty({
    description: 'ISO timestamp when the poll closes',
    example: '2030-12-31T23:59:59.000Z',
  })
  @IsDateString({}, { message: 'closesAt must be a valid ISO date string' })
  closesAt!: string;

  @ApiPropertyOptional({
    description: 'If true, hide results until the poll closes',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'hideResultsUntilClose must be true or false' })
  hideResultsUntilClose?: boolean;
}