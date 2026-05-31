import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ScholarDocument = Scholar & Document;

export interface ScholarBook {
  title: string;
  titleArabic?: string;
  description?: string;
  coverUrl?: string;
  publishYear?: number;
  publisher?: string;
  sourceUrl?: string;
  topics?: string[];
}

@Schema({ timestamps: true })
export class Scholar {
  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  nameArabic?: string;

  @Prop()
  born?: string;

  @Prop()
  died?: string;

  @Prop()
  era?: string; // ex: "VIIe siècle", "XIVe siècle"

  @Prop()
  origin?: string; // ex: "Damas, Syrie"

  @Prop()
  school?: string; // ex: "Hanbalite", "Shafi'ite"

  @Prop({ default: '' })
  biography: string;

  @Prop()
  photoUrl?: string;

  @Prop({ type: [Object], default: [] })
  books: ScholarBook[];

  @Prop({ type: [String], default: [] })
  specialties: string[]; // ex: ["Fiqh", "Aqida", "Tafsir"]

  @Prop({ type: [String], default: [] })
  sources: string[];

  @Prop({ default: 0 })
  views: number;
}

export const ScholarSchema = SchemaFactory.createForClass(Scholar);
ScholarSchema.index({ name: 'text', nameArabic: 'text', biography: 'text' });
ScholarSchema.index({ slug: 1 });
