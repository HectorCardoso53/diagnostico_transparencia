import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSecretariaDto {
  @IsUUID()
  municipio_id: string;

  @IsString()
  nome: string;

  @IsString()
  sigla: string;

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
