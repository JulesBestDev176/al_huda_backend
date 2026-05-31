import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { HadithModule } from './modules/hadith/hadith.module';
import { ScraperModule } from './modules/scraper/scraper.module';
import { SearchModule } from './modules/search/search.module';
import { EmbeddingModule } from './modules/embedding/embedding.module';
import { AdminModule } from './modules/admin/admin.module';
import { ScholarsModule } from './modules/scholars/scholars.module';
import { ForumModule } from './modules/forum/forum.module';

@Module({
  imports: [
    // Configuration (.env)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // MongoDB
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        dbName: 'hadith_db',
      }),
      inject: [ConfigService],
    }),

    // Modules métier
    HadithModule,
    ScraperModule,
    SearchModule,
    EmbeddingModule,
    AdminModule,
    ScholarsModule,
    ForumModule,
  ],
})
export class AppModule {}
