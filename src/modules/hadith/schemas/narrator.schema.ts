import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NarratorDocument = Narrator & Document;

@Schema({ timestamps: true })
export class Narrator {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ type: [String], default: [] })
  aliases: string[];

  @Prop({ default: 'Narrateur' })
  role: string;

  @Prop({ default: '' })
  biography: string;

  @Prop({ type: [String], default: [] })
  bibliography: string[];

  @Prop({ type: [String], default: [] })
  sources: string[];
}

export const NarratorSchema = SchemaFactory.createForClass(Narrator);

// Index pour la recherche textuelle
NarratorSchema.index({ name: 'text', aliases: 'text' }, { weights: { name: 10, aliases: 5 } });
