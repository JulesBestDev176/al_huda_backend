import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AuthenticityGrade } from '../../../common/enums/authenticity.enum';

export type HadithDocument = Hadith & Document;

@Schema({ timestamps: true, suppressReservedKeysWarning: true })
export class Hadith {
  @Prop({ required: true })
  number: number;

  @Prop({ required: true })
  numberInCollection: string;

  // Textes
  @Prop({ required: true, text: true })
  textFrench: string;

  @Prop({ required: true })
  textArabic: string;

  @Prop()
  textEnglish?: string;

  // Narrateur
  @Prop({ required: true })
  narrator: string;

  @Prop()
  isnad?: string;

  // Notes & commentaires de savants extraits du texte (texte brut legacy)
  @Prop()
  commentary?: string;

  // Référence du livre de savant (ex: "Charh Sahih Mouslim, Cheikh Al Etiopi, vol 11 p 414")
  @Prop()
  scholarRef?: string;

  // Commentaires structurés par savant
  @Prop({
    type: [{ scholar: String, work: String, text: String }],
    default: [],
  })
  scholarCommentaries: Array<{ scholar: string; work: string; text: string }>;

  // Collection
  @Prop({ required: true, index: true })
  collection: string;

  @Prop({ required: true })
  collectionLabel: string;

  @Prop({ required: true, index: true })
  bookName: string;

  @Prop({ required: true })
  bookSlug: string;

  @Prop()
  chapterName?: string;

  // Authenticité
  @Prop({
    type: {
      grade: { type: String, enum: Object.values(AuthenticityGrade) },
      gradeArabic: String,
      gradeFrench: String,
      gradeRaw: String,
      score: Number,
      scholar: String,
    },
    required: true,
  })
  authenticity: {
    grade: AuthenticityGrade;
    gradeArabic?: string;
    gradeFrench?: string;
    gradeRaw?: string;
    score: number;
    scholar?: string;
  };

  // Thèmes (enrichis après ingestion)
  @Prop({ type: [String], index: true })
  topics: string[];

  // Source
  @Prop({ required: true })
  sourceUrl: string;

  @Prop({ required: true })
  reference: string;

  // Vector store (Qdrant)
  @Prop()
  qdrantId?: string;

  @Prop({ default: false })
  isEmbedded: boolean;

  // Statistiques
  @Prop({ default: 0 })
  views: number;

  @Prop({ default: 0 })
  shares: number;
}

export const HadithSchema = SchemaFactory.createForClass(Hadith);

// Index texte pour la recherche full-text MongoDB
HadithSchema.index(
  { textFrench: 'text', textArabic: 'text', narrator: 'text', topics: 'text' },
  { weights: { textFrench: 10, narrator: 5, topics: 8, textArabic: 6 } },
);

// Index composé pour filtrage par collection + grade
HadithSchema.index({ collection: 1, 'authenticity.grade': 1 });
HadithSchema.index({ 'authenticity.score': -1 });
