import {
  Controller,
  Post,
  Body,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { PollsService } from './polls.service';
import { CreatePollDto } from './dtos/create-poll.dto';
import { PollResponseDto } from './dtos/poll-response.dto';

@ApiTags('polls')
@Controller('polls')
export class PollsController {
  private readonly logger = new Logger(PollsController.name);

  constructor(private readonly pollsService: PollsService) {}

  //Creates a new poll :)
  @Post()
  @ApiOperation({
    summary: 'Create a new poll',
    description: 'Creates a new poll with question, options and closing time',
  })
  @ApiBody({ type: CreatePollDto })
  @ApiResponse({
    status: 201,
    description: 'Poll created successfully',
    type: PollResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed or invalid data',
  })
  async createPoll(@Body() createPollDto: CreatePollDto): Promise<PollResponseDto> {
    this.logger.log(`POST /polls - Creating poll: ${createPollDto.question}`);
    return this.pollsService.createPoll(createPollDto);
  }
}