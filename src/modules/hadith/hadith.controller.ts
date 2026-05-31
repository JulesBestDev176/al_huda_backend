import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { HadithService } from './hadith.service';
import { AuthenticityGrade } from '../../common/enums/authenticity.enum';

@Controller('hadiths')
export class HadithController {
  constructor(private readonly hadithService: HadithService) {}

  @Get('random')
  getRandom() {
    return this.hadithService.getRandomSahih();
  }

  @Get('collections')
  getCollections() {
    return this.hadithService.getCollections();
  }

  @Get('topics')
  getTopics() {
    return this.hadithService.getTopics();
  }

  @Get('recent')
  getRecent(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.hadithService.getRecent(limit);
  }

  @Get('narrators')
  getNarrators(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.hadithService.getTopNarrators(limit, offset);
  }

  @Get('topics/:topic')
  getByTopic(
    @Param('topic') topic: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.hadithService.findByTopic(topic, limit, offset);
  }

  @Get('grade/:grade')
  getByGrade(
    @Param('grade') grade: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.hadithService.findByGrade(grade as AuthenticityGrade, limit, offset);
  }

  @Get('narrators/:name')
  getNarrator(@Param('name') name: string) {
    return this.hadithService.getNarratorProfile(name);
  }

  @Get('collections/:collection')
  getByCollection(
    @Param('collection') collection: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('grade') grade?: AuthenticityGrade,
  ) {
    return this.hadithService.findByCollection(collection, limit, offset, grade);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.hadithService.findById(id);
  }
}
