import {
  Controller,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { PollsService } from './polls.service';
import { CreatePollDto } from './dtos/create-poll.dto';
import { VoteDto } from './dtos/vote.dto';
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

  /**
   * Cast a vote in a poll
   */
  @Post(':id/votes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cast a vote',
    description: 'Cast a vote for one option in a poll. Each user can vote once per poll.',
  })
  @ApiParam({
    name: 'id',
    description: 'Poll UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: VoteDto })
  @ApiResponse({
    status: 200,
    description: 'Vote cast successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Vote cast successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Poll or option not found',
  })
  @ApiResponse({
    status: 409,
    description: 'User has already voted in this poll',
  })
  @ApiResponse({
    status: 422,
    description: 'Poll has closed',
  })
  async castVote(
    @Param('id', ParseUUIDPipe) pollId: string,
    @Body() voteDto: VoteDto,
  ): Promise<{ message: string }> {
    this.logger.log(`POST /polls/${pollId}/votes - User ${voteDto.userUuid} voting for option ${voteDto.optionId}`);
    return this.pollsService.castVote(pollId, voteDto);
  }
}