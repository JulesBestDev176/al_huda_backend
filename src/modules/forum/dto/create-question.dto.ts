import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  @MinLength(10, { message: 'Le titre doit faire au moins 10 caractères' })
  @MaxLength(200, { message: 'Le titre ne doit pas dépasser 200 caractères' })
  title: string;

  @IsString()
  @MinLength(20, { message: 'La question doit faire au moins 20 caractères' })
  @MaxLength(3000)
  body: string;

  @IsEmail({}, { message: 'Email invalide' })
  authorEmail: string;

  @IsString()
  @MaxLength(60)
  authorName?: string;
}
