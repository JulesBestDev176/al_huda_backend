import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScholarsController } from './scholars.controller';
import { ScholarsService } from './scholars.service';
import { Scholar, ScholarSchema } from './schemas/scholar.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Scholar.name, schema: ScholarSchema }])],
  controllers: [ScholarsController],
  providers: [ScholarsService],
  exports: [ScholarsService],
})
export class ScholarsModule {}
