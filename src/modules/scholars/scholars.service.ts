import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Scholar, ScholarDocument } from './schemas/scholar.schema';

@Injectable()
export class ScholarsService {
  constructor(
    @InjectModel(Scholar.name) private scholarModel: Model<ScholarDocument>,
  ) {}

  async findAll(): Promise<ScholarDocument[]> {
    return this.scholarModel.find().sort({ name: 1 }).exec();
  }

  async findBySlug(slug: string): Promise<ScholarDocument> {
    const scholar = await this.scholarModel.findOne({ slug }).exec();
    if (!scholar) throw new NotFoundException(`Savant "${slug}" introuvable`);
    await this.scholarModel.updateOne({ slug }, { $inc: { views: 1 } });
    return scholar;
  }

  async upsert(data: Partial<Scholar>): Promise<ScholarDocument> {
    return this.scholarModel.findOneAndUpdate(
      { slug: data.slug },
      { $set: data },
      { upsert: true, new: true },
    ).exec();
  }

  async upsertMany(scholars: Partial<Scholar>[]): Promise<number> {
    let count = 0;
    for (const s of scholars) {
      await this.upsert(s);
      count++;
    }
    return count;
  }

  async findAllBooks(): Promise<Array<{ scholar: string; scholarSlug: string; book: any }>> {
    const scholars = await this.scholarModel.find({ 'books.0': { $exists: true } }).exec();
    const books: Array<{ scholar: string; scholarSlug: string; book: any }> = [];
    for (const s of scholars) {
      for (const b of s.books) {
        books.push({ scholar: s.name, scholarSlug: s.slug, book: b });
      }
    }
    return books;
  }
}
