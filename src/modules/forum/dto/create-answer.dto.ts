import { IsEmail, IsMongoId, IsString, MaxLength } from 'class-validator';

export class CreateAnswerDto {
  @IsMongoId()
  questionId: string;

  @IsString()
  @MaxLength(5000)
  body: string;

  @IsEmail({}, { message: 'Email invalide' })
  authorEmail: string;

  @IsString()
  @MaxLength(60)
  authorName?: string;
}
