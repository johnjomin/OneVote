import {
  Controller,
  Get,
  Param,
  Res,
  Logger,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { PollsService } from '../polls.service';
import { ResultsService } from '../results/results.service';
import { filter, map } from 'rxjs/operators';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Poll } from '../entities/poll.entity';

@ApiTags('polls')
@Controller('polls')
export class ResultsStreamController {
  private readonly logger = new Logger(ResultsStreamController.name);
  private readonly heartbeatInterval = (parseInt(process.env.SSE_HEARTBEAT_INTERVAL_SECONDS) || 15) * 1000;

  constructor(
    private readonly pollsService: PollsService,
    private readonly resultsService: ResultsService,
    @InjectRepository(Poll)
    private pollRepository: Repository<Poll>,
  ) {}


  // Server-Sent Events endpoint for real-time poll results
  // Streams result updates when new votes arrive, plus periodic heartbeats
  @Get(':id/stream')
  @ApiOperation({
    summary: 'Stream poll results in real-time',
    description: 'Server-Sent Events endpoint that pushes poll result updates when new votes are cast',
  })
  @ApiParam({
    name: 'id',
    description: 'Poll UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'SSE stream established',
    headers: {
      'Content-Type': {
        description: 'text/event-stream',
        schema: { type: 'string', example: 'text/event-stream' },
      },
      'Cache-Control': {
        description: 'no-cache',
        schema: { type: 'string', example: 'no-cache' },
      },
      Connection: {
        description: 'keep-alive',
        schema: { type: 'string', example: 'keep-alive' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Poll not found',
  })
  async streamResults(
    @Param('id', ParseUUIDPipe) pollId: string,
    @Res() response: Response,
  ): Promise<void> {
    this.logger.log(`SSE connection established for poll ${pollId}`);

    // Verify poll exists before establishing connection
    const poll = await this.pollRepository.findOne({ where: { id: pollId } });
    if (!poll) {
      throw new NotFoundException(`Poll with ID ${pollId} not found`);
    }

    // Set SSE headers
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Send initial connection confirmation
    this.sendSSEMessage(response, 'connected', { pollId, timestamp: new Date().toISOString() });

    // Send current results immediately
    try {
      const currentResults = await this.resultsService.getPollResults(pollId);
      this.sendSSEMessage(response, 'results', currentResults);
    } catch (error) {
      this.logger.error(`Error sending initial results for poll ${pollId}: ${error.message}`);
      this.sendSSEMessage(response, 'error', { message: 'Failed to load current results' });
    }

    // Subscribe to vote events for this specific poll
    const subscription = this.pollsService.voteEvents$
      .pipe(
        filter(event => event.pollId === pollId),
        map(event => event.results)
      )
      .subscribe({
        next: (results) => {
          this.logger.debug(`Sending result update for poll ${pollId}`);
          this.sendSSEMessage(response, 'results', results);
        },
        error: (error) => {
          this.logger.error(`Error in vote events stream for poll ${pollId}: ${error.message}`);
          this.sendSSEMessage(response, 'error', { message: 'Stream error occurred' });
        }
      });

    // Setup periodic heartbeat to keep connection alive
    const heartbeatTimer = setInterval(() => {
      this.sendSSEMessage(response, 'heartbeat', { timestamp: new Date().toISOString() });
    }, this.heartbeatInterval);

    // Cleanup when client disconnects
    response.on('close', () => {
      this.logger.log(`SSE connection closed for poll ${pollId}`);
      subscription.unsubscribe();
      clearInterval(heartbeatTimer);
      response.end();
    });

    // Handle connection errors
    response.on('error', (error) => {
      this.logger.error(`SSE connection error for poll ${pollId}: ${error.message}`);
      subscription.unsubscribe();
      clearInterval(heartbeatTimer);
      response.end();
    });
  }

  // Send a Server-Sent Event message
  private sendSSEMessage(response: Response, event: string, data: any): void {
    try {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      response.write(message);
    } catch (error) {
      this.logger.error(`Failed to send SSE message: ${error.message}`);
    }
  }
}