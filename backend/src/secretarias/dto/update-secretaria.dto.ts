import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { OrgaoTipo } from '../../generated/prisma/enums';

export class UpdateSecretariaDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  sigla?: string;

  @IsEnum(OrgaoTipo)
  @IsOptional()
  tipo?: OrgaoTipo;

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
