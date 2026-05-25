import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FormStatus, Role } from '../generated/prisma/enums';
import { CreateFormularioDto } from './dto/create-formulario.dto';
import { UpdateFormularioDto } from './dto/update-formulario.dto';
import { AtribuirFormularioDto } from './dto/atribuir-formulario.dto';

interface CurrentUser {
  id: string;
  role: Role;
  secretaria_id: string | null;
}

@Injectable()
export class FormulariosService {
  constructor(private prisma: PrismaService) {}

  findAll(filters: {
    secretaria_id?: string;
    diretoria_id?: string;
    status?: FormStatus;
    titulo?: string;
  }) {
    return this.prisma.formSchema.findMany({
      where: {
        ...(filters.secretaria_id && { secretaria_id: filters.secretaria_id }),
        ...(filters.diretoria_id && {
          atribuicoes: { some: { diretoria_id: filters.diretoria_id } },
        }),
        ...(filters.status && { status: filters.status }),
        ...(filters.titulo && {
          titulo: { contains: filters.titulo, mode: 'insensitive' },
        }),
      },
      select: {
        id: true,
        titulo: true,
        descricao: true,
        schema_json: true,
        versao: true,
        status: true,
        publicado_em: true,
        prazo_inicio: true,
        prazo_fim: true,
        created_at: true,
        secretaria: { select: { id: true, nome: true, sigla: true, tipo: true } },
        criado_por: { select: { id: true, nome: true } },
        atribuicoes: {
          select: {
            diretoria: { select: { id: true, nome: true } },
            prazo: true,
            obrigatorio: true,
          },
        },
        respostas: {
          select: {
            id: true,
            status: true,
            diretoria_id: true,
            enviado_em: true,
            usuario: { select: { nome: true } },
          },
        },
        _count: { select: { atribuicoes: true, respostas: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const f = await this.prisma.formSchema.findUnique({
      where: { id },
      include: {
        secretaria: { select: { id: true, nome: true, sigla: true, tipo: true } },
        criado_por: { select: { id: true, nome: true } },
        atribuicoes: {
          include: { diretoria: { select: { id: true, nome: true } } },
        },
        versoes: { orderBy: { versao: 'desc' } },
      },
    });
    if (!f) throw new NotFoundException('Formulário não encontrado');
    return f;
  }

  async create(dto: CreateFormularioDto, user: CurrentUser) {
    const secretaria_id = dto.secretaria_id ?? user.secretaria_id;
    if (!secretaria_id) throw new BadRequestException('secretaria_id é obrigatório');
    this.assertSecretariaAccess(secretaria_id, user);

    const form = await this.prisma.formSchema.create({
      data: {
        secretaria_id,
        criado_por_id: user.id,
        titulo: dto.titulo,
        descricao: dto.descricao,
        schema_json: dto.schema_json as any,
        versao: 1,
        status: FormStatus.RASCUNHO,
        prazo_inicio: dto.prazo_inicio ? new Date(dto.prazo_inicio) : null,
        prazo_fim: dto.prazo_fim ? new Date(dto.prazo_fim) : null,
      },
    });

    // Salva snapshot inicial da versão 1
    await this.prisma.formVersao.create({
      data: {
        form_id: form.id,
        versao: 1,
        schema_json: dto.schema_json as any,
      },
    });

    return form;
  }

  async update(id: string, dto: UpdateFormularioDto, user: CurrentUser) {
    const form = await this.assertExists(id);
    this.assertSecretariaAccess(form.secretaria_id, user);

    if (form.status === FormStatus.ARQUIVADO)
      throw new BadRequestException('Formulários arquivados não podem ser editados');

    const novaVersao = dto.schema_json ? form.versao + 1 : form.versao;

    const updated = await this.prisma.formSchema.update({
      where: { id },
      data: {
        ...(dto.titulo && { titulo: dto.titulo }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.schema_json && {
          schema_json: dto.schema_json as any,
          versao: novaVersao,
        }),
        ...(dto.prazo_inicio && { prazo_inicio: new Date(dto.prazo_inicio) }),
        ...(dto.prazo_fim && { prazo_fim: new Date(dto.prazo_fim) }),
      },
    });

    // Gera snapshot de versão se o schema mudou
    if (dto.schema_json) {
      await this.prisma.formVersao.create({
        data: {
          form_id: id,
          versao: novaVersao,
          schema_json: dto.schema_json as any,
        },
      });
    }

    return updated;
  }

  async publicar(id: string, user: CurrentUser) {
    const form = await this.assertExists(id);
    this.assertSecretariaAccess(form.secretaria_id, user);

    if (form.status !== FormStatus.RASCUNHO)
      throw new BadRequestException(
        'Apenas formulários em rascunho podem ser publicados',
      );

    return this.prisma.formSchema.update({
      where: { id },
      data: { status: FormStatus.PUBLICADO, publicado_em: new Date() },
    });
  }

  async arquivar(id: string, user: CurrentUser) {
    const form = await this.assertExists(id);
    this.assertSecretariaAccess(form.secretaria_id, user);

    if (form.status === FormStatus.ARQUIVADO)
      throw new BadRequestException('Formulário já está arquivado');

    return this.prisma.formSchema.update({
      where: { id },
      data: { status: FormStatus.ARQUIVADO, arquivado_em: new Date() },
    });
  }

  async getVersoes(id: string) {
    await this.assertExists(id);
    return this.prisma.formVersao.findMany({
      where: { form_id: id },
      orderBy: { versao: 'desc' },
    });
  }

  async atribuir(id: string, dto: AtribuirFormularioDto, user: CurrentUser) {
    const form = await this.assertExists(id);
    this.assertSecretariaAccess(form.secretaria_id, user);

    return this.prisma.formAtribuicao.upsert({
      where: { form_id_diretoria_id: { form_id: id, diretoria_id: dto.diretoria_id } },
      update: {
        prazo: dto.prazo ? new Date(dto.prazo) : null,
        obrigatorio: dto.obrigatorio ?? true,
      },
      create: {
        form_id: id,
        diretoria_id: dto.diretoria_id,
        prazo: dto.prazo ? new Date(dto.prazo) : null,
        obrigatorio: dto.obrigatorio ?? true,
      },
    });
  }

  async removerAtribuicao(formId: string, diretoriaId: string, user: CurrentUser) {
    const form = await this.assertExists(formId);
    this.assertSecretariaAccess(form.secretaria_id, user);

    const atribuicao = await this.prisma.formAtribuicao.findUnique({
      where: { form_id_diretoria_id: { form_id: formId, diretoria_id: diretoriaId } },
    });
    if (!atribuicao) throw new NotFoundException('Atribuição não encontrada');

    return this.prisma.formAtribuicao.delete({
      where: { form_id_diretoria_id: { form_id: formId, diretoria_id: diretoriaId } },
    });
  }

  async remove(id: string, user: CurrentUser) {
    const form = await this.assertExists(id);
    this.assertSecretariaAccess(form.secretaria_id, user);

    // Cascade: remove dependências antes de deletar o formulário
    await this.prisma.formAtribuicao.deleteMany({ where: { form_id: id } });
    await this.prisma.formResponse.deleteMany({ where: { form_id: id } });
    await this.prisma.formVersao.deleteMany({ where: { form_id: id } });
    await this.prisma.formSchema.delete({ where: { id } });
  }

  private async assertExists(id: string) {
    const f = await this.prisma.formSchema.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Formulário não encontrado');
    return f;
  }

  private assertSecretariaAccess(secretaria_id: string, user: CurrentUser) {
    const adminRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];
    if (adminRoles.includes(user.role)) return;
    if (user.secretaria_id !== secretaria_id)
      throw new ForbiddenException('Sem permissão para esta secretaria');
  }
}
