import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdatePesquisaDto {
  @IsString()
  @IsOptional()
  titulo?: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsObject()
  @IsOptional()
  schema_json?: object;
}
