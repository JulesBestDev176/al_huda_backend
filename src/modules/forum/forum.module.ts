import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';
import { ForumQuestion, ForumQuestionSchema } from './schemas/forum-question.schema';
import { ForumAnswer, ForumAnswerSchema } from './schemas/forum-answer.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ForumQuestion.name, schema: ForumQuestionSchema },
      { name: ForumAnswer.name, schema: ForumAnswerSchema },
    ]),
  ],
  controllers: [ForumController],
  providers: [ForumService],
})
export class ForumModule {}
