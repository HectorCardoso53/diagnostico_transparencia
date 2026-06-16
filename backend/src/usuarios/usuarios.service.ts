import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { Role } from '../generated/prisma/enums';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

interface CurrentUser {
  id: string;
  role: Role;
  secretaria_id: string | null;
}

function gerarSenhaTemp(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

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

    const { senha, ...rest } = dto;
    const senha_hash = await bcrypt.hash(senha, 12);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });

    let usuario: { id: string; nome: string; email: string; role: string; created_at: Date };

    if (existing) {
      if (existing.ativo) throw new ConflictException('E-mail já cadastrado');
      usuario = await this.prisma.user.update({
        where: { id: existing.id },
        data: { ...rest, senha_hash, ativo: true, refresh_token: null },
        select: { id: true, nome: true, email: true, role: true, created_at: true },
      });
    } else {
      usuario = await this.prisma.user.create({
        data: { ...rest, senha_hash },
        select: { id: true, nome: true, email: true, role: true, created_at: true },
      });
    }

    // Envia e-mail de boas-vindas sem bloquear a resposta
    this.logger.log(`Disparando e-mail de boas-vindas para ${usuario.email}`);
    this.email.sendBoasVindas(usuario.nome, usuario.email, senha).catch((err) => {
      this.logger.error(`Erro no e-mail de boas-vindas: ${(err as Error).message}`);
    });

    return usuario;
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

  async reenviarAcesso(id: string) {
    this.logger.log(`reenviarAcesso chamado para id=${id}`);
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, nome: true, email: true, ativo: true },
    });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    this.logger.log(`Reenviando acesso para ${u.email}`);

    const novaSenha = gerarSenhaTemp();
    const senha_hash = await bcrypt.hash(novaSenha, 12);

    await this.prisma.user.update({
      where: { id },
      data: { senha_hash, refresh_token: null },
    });

    await this.email.sendBoasVindas(u.nome, u.email, novaSenha);

    return { message: 'E-mail enviado com nova senha temporária' };
  }

  private async assertExists(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    return u;
  }

  private assertCanManageRole(role: Role | undefined, user: CurrentUser) {
    if (!role) return;
    if (user.role === Role.SUPER_ADMIN) return;
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
