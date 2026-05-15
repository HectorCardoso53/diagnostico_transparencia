import { IsIn, IsOptional, IsString } from 'class-validator';

export class RevisarRespostaDto {
  @IsIn(['APROVADO', 'REPROVADO', 'EM_REVISAO'])
  status: 'APROVADO' | 'REPROVADO' | 'EM_REVISAO';

  @IsString()
  @IsOptional()
  observacoes?: string;
}
