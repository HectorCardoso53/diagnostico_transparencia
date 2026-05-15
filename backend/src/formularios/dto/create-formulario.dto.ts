import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFormularioDto {
  @IsUUID()
  @IsOptional()
  secretaria_id?: string;

  @IsString()
  titulo: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsObject()
  schema_json: object;

  @IsString()
  @IsOptional()
  prazo_inicio?: string;

  @IsString()
  @IsOptional()
  prazo_fim?: string;
}
