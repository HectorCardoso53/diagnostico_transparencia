import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  senha: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  secretaria_id?: string;

  @IsOptional()
  @IsString()
  diretoria_id?: string;
}
