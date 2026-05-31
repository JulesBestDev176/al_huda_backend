import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchHadithDto } from '../hadith/dto/search-hadith.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query() dto: SearchHadithDto) {
    return this.searchService.search(dto);
  }

  @Get('suggest')
  suggest(
    @Query('q') query: string,
    @Query('limit') limit = 5,
  ) {
    return this.searchService.suggest(query, +limit);
  }

  @Post('index-embeddings')
  indexEmbeddings(@Body('batchSize') batchSize = 50) {
    // Lance l'indexation en arrière-plan
    this.searchService.indexPendingEmbeddings(+batchSize).then((result) => {
      console.log('Indexation terminée:', result);
    });
    return { message: 'Indexation des embeddings lancée', status: 'started' };
  }
}
