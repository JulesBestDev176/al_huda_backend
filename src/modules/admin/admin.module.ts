import { Module } from '@nestjs/common';
import { HadithModule } from '../hadith/hadith.module';
import { ScraperModule } from '../scraper/scraper.module';
import { SearchModule } from '../search/search.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [HadithModule, ScraperModule, SearchModule],
  controllers: [AdminController],
})
export class AdminModule {}
