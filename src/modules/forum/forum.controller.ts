import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ForumService } from './forum.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';

@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  // GET /api/forum/questions
  @Get('questions')
  getQuestions(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('topic') topic?: string,
  ) {
    return this.forumService.getQuestions(limit, offset, topic);
  }

  // GET /api/forum/questions/:id
  @Get('questions/:id')
  getQuestion(@Param('id') id: string) {
    return this.forumService.getQuestion(id);
  }

  // POST /api/forum/questions
  @Post('questions')
  @HttpCode(HttpStatus.CREATED)
  createQuestion(@Body() dto: CreateQuestionDto) {
    return this.forumService.createQuestion(dto);
  }

  // POST /api/forum/answers
  @Post('answers')
  @HttpCode(HttpStatus.CREATED)
  createAnswer(@Body() dto: CreateAnswerDto) {
    return this.forumService.createAnswer(dto);
  }
}
