import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ForumAnswerDocument = ForumAnswer & Document;

@Schema({ timestamps: true })
export class ForumAnswer {
  @Prop({ type: Types.ObjectId, ref: 'ForumQuestion', required: true, index: true })
  questionId: Types.ObjectId;

  @Prop({ required: true })
  body: string;

  @Prop({ required: true })
  authorEmail: string;

  @Prop({ default: 'Anonyme' })
  authorName: string;

  @Prop({ enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';

  @Prop({ type: { approved: Boolean, reason: String, flags: [String] } })
  aiAnalysis?: { approved: boolean; reason: string; flags: string[] };
}

export const ForumAnswerSchema = SchemaFactory.createForClass(ForumAnswer);
ForumAnswerSchema.index({ questionId: 1, status: 1, createdAt: 1 });
