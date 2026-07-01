import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseStatus, Role } from '../generated/prisma/enums';
import { CreateRespostaDto } from './dto/create-resposta.dto';
import { RevisarRespostaDto } from './dto/revisar-resposta.dto';

interface CurrentUser {
  id: string;
  role: Role;
  secretaria_id: string | null;
  diretoria_id: string | null;
}

@Injectable()
export class RespostasService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    filters: {
      form_id?: string;
      diretoria_id?: string;
      status?: ResponseStatus;
    },
    user: CurrentUser,
  ) {
    const scopedDiretoria = this.getScopedDiretoria(filters.diretoria_id, user);

    const rows = await this.prisma.formResponse.findMany({
      where: {
        ...(filters.form_id && { form_id: filters.form_id }),
        ...(scopedDiretoria && { diretoria_id: scopedDiretoria }),
        ...(filters.status && { status: filters.status }),
        ...(user.role === Role.OPERADOR && { user_id: user.id }),
      },
      include: {
        form: { select: { id: true, titulo: true, versao: true } },
        diretoria: {
          select: {
            id: true, nome: true,
            secretaria: { select: { id: true, nome: true, sigla: true } },
          },
        },
        usuario: { select: { id: true, nome: true } },
      },
      orderBy: { updated_at: 'desc' },
    });

    return rows.map(({ form, ...r }) => ({ ...r, formulario: form }));
  }

  async findOne(id: string, user: CurrentUser) {
    const r = await this.prisma.formResponse.findUnique({
      where: { id },
      include: {
        form: {
          select: { id: true, titulo: true, descricao: true, schema_json: true },
        },
        diretoria: { select: { id: true, nome: true } },
        usuario: { select: { id: true, nome: true } },
      },
    });
    if (!r) throw new NotFoundException('Resposta não encontrada');
    this.assertReadAccess(r, user);
    const { form, ...rest } = r;
    return { ...rest, formulario: form };
  }

  async create(dto: CreateRespostaDto, user: CurrentUser) {
    const form = await this.prisma.formSchema.findUnique({
      where: { id: dto.form_id },
    });
    if (!form) throw new NotFoundException('Formulário não encontrado');
    if (form.status !== 'PUBLICADO')
      throw new BadRequestException('Formulário não está publicado');

    // Resposta de secretário (sem diretoria)
    if (!dto.diretoria_id) {
      if (user.role !== Role.SECRETARIO)
        throw new ForbiddenException(
          'Apenas secretários podem responder formulários sem diretoria',
        );
      if (form.secretaria_id !== user.secretaria_id)
        throw new ForbiddenException('Sem acesso a este formulário');

      const existente = await this.prisma.formResponse.findFirst({
        where: { form_id: dto.form_id, diretoria_id: null },
      });
      if (existente)
        throw new BadRequestException('Já existe uma resposta para este formulário');

      return this.prisma.formResponse.create({
        data: {
          form_id: dto.form_id,
          diretoria_id: null,
          user_id: user.id,
          dados_json: dto.dados_json as any,
          status: ResponseStatus.RASCUNHO,
        },
      });
    }

    // Resposta de diretoria
    const atribuicao = await this.prisma.formAtribuicao.findUnique({
      where: {
        form_id_diretoria_id: {
          form_id: dto.form_id,
          diretoria_id: dto.diretoria_id,
        },
      },
    });
    if (!atribuicao)
      throw new BadRequestException(
        'Formulário não atribuído a esta diretoria',
      );

    const existente = await this.prisma.formResponse.findFirst({
      where: { form_id: dto.form_id, diretoria_id: dto.diretoria_id },
    });
    if (existente)
      throw new BadRequestException(
        'Já existe uma resposta para este formulário nesta diretoria',
      );

    if (
      ([Role.OPERADOR, Role.DIRETOR] as Role[]).includes(user.role) &&
      user.diretoria_id !== dto.diretoria_id
    )
      throw new ForbiddenException('Sem permissão para esta diretoria');

    return this.prisma.formResponse.create({
      data: {
        form_id: dto.form_id,
        diretoria_id: dto.diretoria_id,
        user_id: user.id,
        dados_json: dto.dados_json as any,
        status: ResponseStatus.RASCUNHO,
      },
    });
  }

  async updateRascunho(
    id: string,
    dados_json: Record<string, unknown>,
    user: CurrentUser,
  ) {
    const r = await this.assertExists(id);

    const editRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO];
    const canEdit =
      editRoles.includes(user.role) ||
      r.user_id === user.id ||
      (user.role === Role.DIRETOR && user.diretoria_id != null && user.diretoria_id === r.diretoria_id);
    if (!canEdit)
      throw new ForbiddenException('Sem permissão para editar esta resposta');
    if (r.status !== ResponseStatus.RASCUNHO)
      throw new BadRequestException(
        'Somente rascunhos podem ser editados',
      );

    return this.prisma.formResponse.update({
      where: { id },
      data: { dados_json: dados_json as any },
    });
  }

  async enviar(id: string, user: CurrentUser) {
    const r = await this.assertExists(id);

    const sendRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO];
    const canSend =
      sendRoles.includes(user.role) ||
      r.user_id === user.id ||
      (user.role === Role.DIRETOR && user.diretoria_id != null && user.diretoria_id === r.diretoria_id);
    if (!canSend)
      throw new ForbiddenException('Sem permissão para enviar esta resposta');
    if (r.status !== ResponseStatus.RASCUNHO)
      throw new BadRequestException(
        'Somente rascunhos podem ser enviados',
      );

    return this.prisma.formResponse.update({
      where: { id },
      data: { status: ResponseStatus.ENVIADO, enviado_em: new Date() },
    });
  }

  async revisar(id: string, dto: RevisarRespostaDto, user: CurrentUser) {
    const r = await this.assertExists(id);

    this.assertRevisaoAccess(r, user);

    if (r.status === ResponseStatus.RASCUNHO)
      throw new BadRequestException('Resposta ainda não foi enviada');

    return this.prisma.formResponse.update({
      where: { id },
      data: {
        status: dto.status,
        revisado_em: new Date(),
        revisado_por: user.id,
        observacoes: dto.observacoes ?? null,
      },
    });
  }

  async remove(id: string, user: CurrentUser) {
    const r = await this.assertExists(id);

    const adminRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];
    if (!adminRoles.includes(user.role)) {
      if (r.user_id !== user.id)
        throw new ForbiddenException('Sem permissão para excluir esta resposta');
      if (r.status !== ResponseStatus.RASCUNHO)
        throw new BadRequestException('Somente rascunhos podem ser excluídos pelo autor');
    }

    await this.prisma.formResponse.delete({ where: { id } });
  }

  private async assertExists(id: string) {
    const r = await this.prisma.formResponse.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Resposta não encontrada');
    return r;
  }

  private assertReadAccess(
    r: { user_id: string; diretoria_id: string | null },
    user: CurrentUser,
  ) {
    const adminRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];
    if (adminRoles.includes(user.role)) return;
    if (user.role === Role.SECRETARIO) return;
    if (user.role === Role.OPERADOR && r.user_id !== user.id)
      throw new ForbiddenException('Sem permissão para visualizar esta resposta');
    if (user.role === Role.DIRETOR) {
      if (r.user_id === user.id) return;
      if (user.diretoria_id && user.diretoria_id === r.diretoria_id) return;
      throw new ForbiddenException('Sem permissão para visualizar esta resposta');
    }
  }

  private assertRevisaoAccess(
    r: { diretoria_id: string | null },
    user: CurrentUser,
  ) {
    const adminRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO];
    if (adminRoles.includes(user.role)) return;
    if (user.role === Role.DIRETOR && r.diretoria_id && user.diretoria_id === r.diretoria_id)
      return;
    throw new ForbiddenException('Sem permissão para revisar esta resposta');
  }

  private getScopedDiretoria(
    diretoria_id: string | undefined,
    user: CurrentUser,
  ) {
    if (user.role === Role.DIRETOR) return user.diretoria_id ?? undefined;
    return diretoria_id;
  }
}
