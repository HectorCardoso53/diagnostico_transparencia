import { IsObject, IsUUID } from 'class-validator';

export class CreateRespostaDto {
  @IsUUID()
  form_id: string;

  @IsUUID()
  diretoria_id: string;

  @IsObject()
  dados_json: Record<string, unknown>;
}
