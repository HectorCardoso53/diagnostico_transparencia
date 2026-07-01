import { IsObject, IsOptional, IsString } from 'class-validator';

export class ResponderPesquisaDto {
  @IsString()
  nome: string;

  @IsString()
  @IsOptional()
  secretaria?: string;

  @IsString()
  @IsOptional()
  diretoria?: string;

  @IsString()
  @IsOptional()
  cargo?: string;

  @IsObject()
  dados_json: object;

  @IsString()
  @IsOptional()
  token_browser?: string;
}
