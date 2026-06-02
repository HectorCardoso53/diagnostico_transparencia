import { IsObject, IsOptional, IsUUID } from 'class-validator';

export class CreateRespostaDto {
  @IsUUID()
  form_id: string;

  @IsOptional()
  @IsUUID()
  diretoria_id?: string;

  @IsObject()
  dados_json: Record<string, unknown>;
}
