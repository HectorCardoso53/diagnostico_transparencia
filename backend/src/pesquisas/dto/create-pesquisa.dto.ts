import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreatePesquisaDto {
  @IsString()
  titulo: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsObject()
  @IsOptional()
  schema_json?: object;
}
