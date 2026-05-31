import { Module } from '@nestjs/common';
import { BibliothequeIslamiqueScraper } from './scrapers/bibliotheque-islamique.scraper';
import { ScraperService } from './scraper.service';
import { ScraperController } from './scraper.controller';
import { HadithModule } from '../hadith/hadith.module';

@Module({
  imports: [HadithModule],
  providers: [BibliothequeIslamiqueScraper, ScraperService],
  controllers: [ScraperController],
  exports: [ScraperService],
})
export class ScraperModule {}
