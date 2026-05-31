import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ScraperService } from './scraper.service';

@Controller('admin/scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Get('status')
  getStatus() {
    return this.scraperService.getStatus();
  }

  @Post('run')
  runAll(@Body('collections') collections?: string[]) {
    // Lance en arrière-plan sans bloquer la réponse HTTP
    this.scraperService.scrapeAll(collections).then((results) => {
      console.log('Scraping terminé:', results);
    });
    return { message: 'Scraping lancé en arrière-plan', status: 'started' };
  }

  @Post('run/collection')
  runCollection(@Body('collectionId') collectionId: string) {
    const collections = this.scraperService['scraper'].getCollections();
    const collection = collections.find((c) => c.id === collectionId);
    if (!collection) return { error: `Collection "${collectionId}" introuvable` };

    this.scraperService.scrapeCollection(collection).then((result) => {
      console.log('Scraping collection terminé:', result);
    });

    return { message: `Scraping de "${collectionId}" lancé`, status: 'started' };
  }
}
