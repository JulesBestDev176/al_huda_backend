import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ForumQuestionDocument = ForumQuestion & Document;

export type ModerationStatus = 'pending' | 'approved' | 'rejected';

@Schema({ timestamps: true })
export class ForumQuestion {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ required: true })
  authorEmail: string;

  @Prop({ default: 'Anonyme' })
  authorName: string;

  @Prop({ enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  status: ModerationStatus;

  @Prop({ type: { approved: Boolean, reason: String, flags: [String] } })
  aiAnalysis?: { approved: boolean; reason: string; flags: string[] };

  @Prop({ type: [String], default: [] })
  topics: string[];

  @Prop({ default: 0 })
  answersCount: number;
}

export const ForumQuestionSchema = SchemaFactory.createForClass(ForumQuestion);
ForumQuestionSchema.index({ title: 'text', body: 'text' });
ForumQuestionSchema.index({ status: 1, createdAt: -1 });
