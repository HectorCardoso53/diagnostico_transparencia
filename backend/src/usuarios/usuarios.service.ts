import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../generated/prisma/enums';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

interface CurrentUser {
  id: string;
  role: Role;
  secretaria_id: string | null;
}

@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

  findAll(
    filters: {
      role?: Role;
      secretaria_id?: string;
      diretoria_id?: string;
      ativo?: boolean;
      nome?: string;
    },
    user: CurrentUser,
  ) {
    const scopedSecretaria =
      user.role === Role.SECRETARIO
        ? user.secretaria_id ?? undefined
        : filters.secretaria_id;

    return this.prisma.user.findMany({
      where: {
        ...(filters.role && { role: filters.role }),
        ...(scopedSecretaria && { secretaria_id: scopedSecretaria }),
        ...(filters.diretoria_id && { diretoria_id: filters.diretoria_id }),
        ...(filters.ativo !== undefined && { ativo: filters.ativo }),
        ...(filters.nome && {
          nome: { contains: filters.nome, mode: 'insensitive' },
        }),
      },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        secretaria_id: true,
        diretoria_id: true,
        ativo: true,
        ultimo_login: true,
        created_at: true,
        secretaria: { select: { id: true, nome: true } },
        diretoria: { select: { id: true, nome: true } },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        secretaria_id: true,
        diretoria_id: true,
        ativo: true,
        ultimo_login: true,
        created_at: true,
        updated_at: true,
        secretaria: { select: { id: true, nome: true } },
        diretoria: { select: { id: true, nome: true } },
      },
    });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    return u;
  }

  async create(dto: CreateUsuarioDto, currentUser: CurrentUser) {
    this.assertCanManageRole(dto.role, currentUser);

    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('E-mail já cadastrado');

    const { senha, ...rest } = dto;
    const senha_hash = await bcrypt.hash(senha, 12);

    return this.prisma.user.create({
      data: { ...rest, senha_hash },
      select: { id: true, nome: true, email: true, role: true, created_at: true },
    });
  }

  async update(id: string, dto: UpdateUsuarioDto, currentUser: CurrentUser) {
    await this.assertExists(id);
    this.assertCanManageRole(dto.role, currentUser);

    if (dto.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (conflict) throw new ConflictException('E-mail já em uso');
    }

    const { senha, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (senha) data.senha_hash = await bcrypt.hash(senha, 12);

    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, nome: true, email: true, role: true, ativo: true },
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    return this.prisma.user.update({
      where: { id },
      data: { ativo: false, refresh_token: null },
      select: { id: true, nome: true, ativo: true },
    });
  }

  private async assertExists(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    return u;
  }

  private assertCanManageRole(role: Role | undefined, user: CurrentUser) {
    if (!role) return;
    const hierarchy: Record<Role, number> = {
      [Role.SUPER_ADMIN]: 5,
      [Role.ADMIN]: 4,
      [Role.SECRETARIO]: 3,
      [Role.DIRETOR]: 2,
      [Role.OPERADOR]: 1,
    };
    if (hierarchy[role] >= hierarchy[user.role])
      throw new ForbiddenException('Não é possível atribuir role igual ou superior ao seu');
  }
}
