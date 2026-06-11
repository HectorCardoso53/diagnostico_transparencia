import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../generated/prisma/enums';
import { CreateDiretoriaDto } from './dto/create-diretoria.dto';
import { UpdateDiretoriaDto } from './dto/update-diretoria.dto';

interface CurrentUser {
  id: string;
  role: Role;
  secretaria_id: string | null;
}

@Injectable()
export class DiretoriasService {
  constructor(private prisma: PrismaService) {}

  findAll(filters: {
    secretaria_id?: string;
    nome?: string;
    ativo?: boolean;
  }) {
    return this.prisma.diretoria.findMany({
      where: {
        ...(filters.secretaria_id && { secretaria_id: filters.secretaria_id }),
        ...(filters.nome && {
          nome: { contains: filters.nome, mode: 'insensitive' },
        }),
        ...(filters.ativo !== undefined && { ativo: filters.ativo }),
      },
      include: {
        secretaria: { select: { id: true, nome: true, sigla: true } },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: string) {
    const d = await this.prisma.diretoria.findUnique({
      where: { id },
      include: {
        secretaria: { select: { id: true, nome: true, sigla: true } },
        usuarios: {
          where: { ativo: true },
          select: { id: true, nome: true, email: true, role: true },
        },
      },
    });
    if (!d) throw new NotFoundException('Diretoria não encontrada');
    return d;
  }

  async create(dto: CreateDiretoriaDto, user: CurrentUser) {
    this.assertSecretariaAccess(dto.secretaria_id, user);
    const { secretaria_id, nome, sigla, descricao, responsavel, email } = dto;
    return this.prisma.diretoria.create({
      data: { secretaria_id, nome, sigla, descricao, responsavel, email },
    });
  }

  async update(id: string, dto: UpdateDiretoriaDto, user: CurrentUser) {
    const d = await this.assertExists(id);
    this.assertSecretariaAccess(d.secretaria_id, user);
    return this.prisma.diretoria.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: CurrentUser) {
    const d = await this.assertExists(id);
    this.assertSecretariaAccess(d.secretaria_id, user);
    return this.prisma.diretoria.update({
      where: { id },
      data: { ativo: false },
    });
  }

  private async assertExists(id: string) {
    const d = await this.prisma.diretoria.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Diretoria não encontrada');
    return d;
  }

  private assertSecretariaAccess(secretaria_id: string, user: CurrentUser) {
    const adminRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];
    if (adminRoles.includes(user.role)) return;
    if (user.secretaria_id !== secretaria_id)
      throw new ForbiddenException('Sem permissão para esta secretaria');
  }
}
