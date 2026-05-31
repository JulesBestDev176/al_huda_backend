import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Hadith, HadithSchema } from './schemas/hadith.schema';
import { Narrator, NarratorSchema } from './schemas/narrator.schema';
import { HadithService } from './hadith.service';
import { HadithController } from './hadith.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Hadith.name, schema: HadithSchema },
      { name: Narrator.name, schema: NarratorSchema }
    ]),
  ],
  providers: [HadithService],
  controllers: [HadithController],
  exports: [HadithService],
})
export class HadithModule {}
