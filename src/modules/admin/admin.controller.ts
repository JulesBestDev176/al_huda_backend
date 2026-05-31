import { Body, Controller, Get, Post } from '@nestjs/common';
import { HadithService } from '../hadith/hadith.service';
import { ScraperService } from '../scraper/scraper.service';
import { SearchService } from '../search/search.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly hadithService: HadithService,
    private readonly scraperService: ScraperService,
    private readonly searchService: SearchService,
  ) {}

  @Get('stats')
  getStats() {
    return this.hadithService.getStats();
  }

  @Get('scrape/status')
  getScrapeStatus() {
    return this.scraperService.getStatus();
  }

  @Post('scrape/trigger')
  triggerScrape(@Body('collections') collections?: string[]) {
    this.scraperService.scrapeAll(collections).then((results) => {
      console.log('Scraping terminé:', results);
    });

    return { message: 'Scraping lancé en arrière-plan', status: 'started' };
  }

  @Post('embed/rebuild')
  rebuildEmbeddings(@Body('batchSize') batchSize = 50) {
    this.searchService.indexPendingEmbeddings(+batchSize).then((result) => {
      console.log('Réindexation des embeddings terminée:', result);
    });

    return { message: 'Réindexation des embeddings lancée', status: 'started' };
  }

  @Post('enrich/commentaries')
  enrichCommentaries() {
    this.hadithService.enrichCommentaries().then((result) => {
      console.log('Enrichissement commentaires terminé:', result);
    });

    return { message: 'Enrichissement des commentaires lancé', status: 'started' };
  }
}
