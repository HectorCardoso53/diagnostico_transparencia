import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { OrgaoTipo } from '../../generated/prisma/enums';

export class CreateSecretariaDto {
  @IsUUID()
  @IsOptional()
  municipio_id?: string;

  // Alternativa: informar nome + UF para criar/encontrar município automaticamente
  @IsString()
  @IsOptional()
  municipio_nome?: string;

  @IsString()
  @IsOptional()
  @Length(2, 2)
  municipio_uf?: string;

  @IsString()
  nome: string;

  @IsString()
  sigla: string;

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
}
