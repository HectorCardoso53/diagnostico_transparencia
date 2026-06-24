import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateFormularioDto {
  @IsString()
  @IsOptional()
  titulo?: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsObject()
  @IsOptional()
  schema_json?: object;

  @IsString()
  @IsOptional()
  secretaria_id?: string;

  @IsString()
  @IsOptional()
  prazo_inicio?: string;

  @IsString()
  @IsOptional()
  prazo_fim?: string;
}
