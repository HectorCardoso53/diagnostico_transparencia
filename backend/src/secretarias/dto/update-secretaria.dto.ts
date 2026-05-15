import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateSecretariaDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  sigla?: string;

  @IsString()
  @IsOptional()
  descricao?: string;

  @IsString()
  @IsOptional()
  responsavel?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  telefone?: string;

  @IsBoolean()
  @IsOptional()
  ativo?: boolean;
}
