import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

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
      },
    };
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, ativo: true },
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
