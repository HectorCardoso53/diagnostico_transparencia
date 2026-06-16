import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { Role } from '../generated/prisma/enums';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private email: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing && existing.ativo) throw new ConflictException('E-mail já cadastrado');

    const senha_hash = await bcrypt.hash(dto.senha, 12);

    const allowedRoles: Role[] = [Role.SECRETARIO, Role.DIRETOR, Role.OPERADOR];
    const role: Role = dto.role && allowedRoles.includes(dto.role as Role)
      ? (dto.role as Role)
      : Role.OPERADOR;

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            nome: dto.nome, senha_hash, role, ativo: true, refresh_token: null,
            secretaria_id: dto.secretaria_id ?? null,
            diretoria_id: dto.diretoria_id ?? null,
          },
          select: { id: true, nome: true, email: true, role: true },
        })
      : await this.prisma.user.create({
          data: {
            nome: dto.nome, email: dto.email, senha_hash, role,
            secretaria_id: dto.secretaria_id ?? null,
            diretoria_id: dto.diretoria_id ?? null,
          },
          select: { id: true, nome: true, email: true, role: true },
        });

    this.email.sendBoasVindas(user.nome, user.email, dto.senha).catch(() => {});

    return { message: 'Cadastro realizado! Aguarde a liberação do seu acesso pelo administrador.' };
  }

  async recuperarSenha(email: string, novaSenha: string) {
    const user = await this.prisma.user.findUnique({ where: { email, ativo: true } });
    if (!user) throw new UnauthorizedException('E-mail não encontrado');
    const senha_hash = await bcrypt.hash(novaSenha, 12);
    await this.prisma.user.update({ where: { id: user.id }, data: { senha_hash } });
    return { message: 'Senha alterada com sucesso!' };
  }

  private gerarSenhaTemp(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  async getPublicOptions() {
    const [secretarias, diretorias] = await Promise.all([
      this.prisma.secretaria.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, sigla: true },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.diretoria.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, sigla: true, secretaria_id: true },
        orderBy: { nome: 'asc' },
      }),
    ]);
    return { secretarias, diretorias };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email, ativo: true },
    });

    if (!user || !(await bcrypt.compare(dto.senha, user.senha_hash))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refresh_token);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { ultimo_login: new Date() },
    });

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      usuario: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        secretaria_id: user.secretaria_id,
        diretoria_id: user.diretoria_id,
      },
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, ativo: true },
    });

    if (!user?.refresh_token) throw new UnauthorizedException();

    const valid = await bcrypt.compare(refreshToken, user.refresh_token);
    if (!valid) throw new UnauthorizedException();

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refresh_token);
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refresh_token: null },
    });
  }

  private async generateTokens(user: {
    id: string;
    email: string;
    role: string;
    secretaria_id: string | null;
    diretoria_id: string | null;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      secretaria_id: user.secretaria_id,
      diretoria_id: user.diretoria_id,
    };

    const accessExpires = process.env.JWT_EXPIRES_IN ?? '15m';
    const refreshExpires = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

    const [access_token, refresh_token] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: accessExpires as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
      this.jwt.signAsync(
        { sub: user.id },
        {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: refreshExpires as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      ),
    ]);

    return { access_token, refresh_token };
  }

  private async saveRefreshToken(userId: string, token: string) {
    const hashed = await bcrypt.hash(token, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refresh_token: hashed },
    });
  }
}
