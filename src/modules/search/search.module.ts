import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Hadith, HadithSchema } from '../hadith/schemas/hadith.schema';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { VectorService } from './vector.service';
import { EmbeddingModule } from '../embedding/embedding.module';
import { HadithModule } from '../hadith/hadith.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Hadith.name, schema: HadithSchema }]),
    EmbeddingModule,
    HadithModule,
  ],
  providers: [SearchService, VectorService],
  controllers: [SearchController],
  exports: [SearchService, VectorService],
})
export class SearchModule {}
