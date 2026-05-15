import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class AtribuirFormularioDto {
  @IsUUID()
  diretoria_id: string;

  @IsString()
  @IsOptional()
  prazo?: string;

  @IsBoolean()
  @IsOptional()
  obrigatorio?: boolean;
}
