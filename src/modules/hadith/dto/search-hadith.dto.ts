import { IsOptional, IsString, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AuthenticityGrade } from '../../../common/enums/authenticity.enum';

export class SearchHadithDto {
  @IsString()
  q: string;

  @IsOptional()
  @IsEnum(AuthenticityGrade)
  grade?: AuthenticityGrade;

  @IsOptional()
  @IsString()
  collection?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  narrator?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  // Exclure les hadiths mawdu (forgés) par défaut
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  excludeMawdu?: boolean = true;
}
