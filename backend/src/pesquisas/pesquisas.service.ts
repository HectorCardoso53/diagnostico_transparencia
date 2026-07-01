import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PesquisaStatus, Role } from '../generated/prisma/enums';
import { CreatePesquisaDto } from './dto/create-pesquisa.dto';
import { UpdatePesquisaDto } from './dto/update-pesquisa.dto';
import { ResponderPesquisaDto } from './dto/responder-pesquisa.dto';

interface CurrentUser {
  id: string;
  role: Role;
}

@Injectable()
export class PesquisasService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.pesquisaOpiniao.findMany({
      select: {
        id: true,
        titulo: true,
        descricao: true,
        status: true,
        publicado_em: true,
        encerrado_em: true,
        created_at: true,
        criador: { select: { id: true, nome: true } },
        _count: { select: { respostas: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const p = await this.prisma.pesquisaOpiniao.findUnique({
      where: { id },
      select: {
        id: true,
        titulo: true,
        descricao: true,
        schema_json: true,
        status: true,
        publicado_em: true,
        encerrado_em: true,
        created_at: true,
        criador: { select: { id: true, nome: true } },
        _count: { select: { respostas: true } },
      },
    });
    if (!p) throw new NotFoundException('Pesquisa não encontrada');
    return p;
  }

  async findPublic(id: string) {
    const p = await this.prisma.pesquisaOpiniao.findUnique({
      where: { id },
      select: {
        id: true,
        titulo: true,
        descricao: true,
        schema_json: true,
        status: true,
      },
    });
    if (!p) throw new NotFoundException('Pesquisa não encontrada');
    if (p.status !== PesquisaStatus.PUBLICADA)
      throw new BadRequestException('Esta pesquisa não está disponível');
    return p;
  }

  async create(dto: CreatePesquisaDto, user: CurrentUser) {
    this.assertAdmin(user);
    return this.prisma.pesquisaOpiniao.create({
      data: {
        titulo: dto.titulo,
        descricao: dto.descricao,
        schema_json: (dto.schema_json ?? { campos: [] }) as any,
        criado_por_id: user.id,
      },
      select: { id: true, titulo: true, status: true },
    });
  }

  async update(id: string, dto: UpdatePesquisaDto, user: CurrentUser) {
    this.assertAdmin(user);
    await this.assertExists(id);
    return this.prisma.pesquisaOpiniao.update({
      where: { id },
      data: {
        ...(dto.titulo && { titulo: dto.titulo }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.schema_json && { schema_json: dto.schema_json as any }),
      },
    });
  }

  async publicar(id: string, user: CurrentUser) {
    this.assertAdmin(user);
    const p = await this.assertExists(id);
    if (p.status !== PesquisaStatus.RASCUNHO)
      throw new BadRequestException('Apenas rascunhos podem ser publicados');
    return this.prisma.pesquisaOpiniao.update({
      where: { id },
      data: { status: PesquisaStatus.PUBLICADA, publicado_em: new Date() },
    });
  }

  async encerrar(id: string, user: CurrentUser) {
    this.assertAdmin(user);
    const p = await this.assertExists(id);
    if (p.status !== PesquisaStatus.PUBLICADA)
      throw new BadRequestException('Apenas pesquisas publicadas podem ser encerradas');
    return this.prisma.pesquisaOpiniao.update({
      where: { id },
      data: { status: PesquisaStatus.ENCERRADA, encerrado_em: new Date() },
    });
  }

  async remove(id: string, user: CurrentUser) {
    this.assertAdmin(user);
    await this.assertExists(id);
    await this.prisma.respostaOpiniao.deleteMany({ where: { pesquisa_id: id } });
    await this.prisma.pesquisaOpiniao.delete({ where: { id } });
  }

  async responder(id: string, dto: ResponderPesquisaDto) {
    const p = await this.findPublic(id);

    // Verifica duplicidade por token do browser
    if (dto.token_browser) {
      const existing = await this.prisma.respostaOpiniao.findFirst({
        where: { pesquisa_id: p.id, token_browser: dto.token_browser },
      });
      if (existing) throw new BadRequestException('Você já respondeu esta pesquisa');
    }

    return this.prisma.respostaOpiniao.create({
      data: {
        pesquisa_id: id,
        nome: dto.nome,
        secretaria: dto.secretaria,
        diretoria: dto.diretoria,
        cargo: dto.cargo,
        dados_json: dto.dados_json as any,
        token_browser: dto.token_browser,
      },
      select: { id: true },
    });
  }

  async getResultados(id: string, user: CurrentUser) {
    this.assertAdmin(user);
    await this.assertExists(id);
    const respostas = await this.prisma.respostaOpiniao.findMany({
      where: { pesquisa_id: id },
      select: {
        id: true,
        nome: true,
        secretaria: true,
        diretoria: true,
        cargo: true,
        dados_json: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
    return respostas;
  }

  private async assertExists(id: string) {
    const p = await this.prisma.pesquisaOpiniao.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Pesquisa não encontrada');
    return p;
  }

  private assertAdmin(user: CurrentUser) {
    const allowed: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];
    if (!allowed.includes(user.role))
      throw new ForbiddenException('Acesso restrito a administradores');
  }
}
