import { IsString, IsArray, IsDateString, IsOptional, IsBoolean, ArrayMinSize, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePollDto {
  @ApiProperty({
    description: 'The poll question',
    example: 'What is your favorite programming language?',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  question: string;

  @ApiProperty({
    description: 'Array of poll options (minimum 2 required)',
    example: ['JavaScript', 'TypeScript', 'Python', 'Go'],
    minItems: 2,
  })
  @IsArray()
  @ArrayMinSize(2, { message: 'Poll must have at least 2 options' })
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  options: string[];

  @ApiProperty({
    description: 'ISO timestamp when the poll closes',
    example: '2024-12-31T23:59:59.000Z',
  })
  @IsDateString()
  closesAt: string;

  @ApiPropertyOptional({
    description: 'Whether to hide results until poll closes',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  hideResultsUntilClose?: boolean;
}