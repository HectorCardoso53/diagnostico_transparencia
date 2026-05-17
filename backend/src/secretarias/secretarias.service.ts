import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../generated/prisma/enums';
import { CreateSecretariaDto } from './dto/create-secretaria.dto';
import { UpdateSecretariaDto } from './dto/update-secretaria.dto';

interface CurrentUser {
  id: string;
  role: Role;
  secretaria_id: string | null;
}

@Injectable()
export class SecretariasService {
  constructor(private prisma: PrismaService) {}

  findAll(filters: {
    nome?: string;
    municipio_id?: string;
    ativo?: boolean;
    sigla?: string;
  }) {
    return this.prisma.secretaria.findMany({
      where: {
        ...(filters.nome && {
          nome: { contains: filters.nome, mode: 'insensitive' },
        }),
        ...(filters.municipio_id && { municipio_id: filters.municipio_id }),
        ...(filters.sigla && {
          sigla: { contains: filters.sigla, mode: 'insensitive' },
        }),
        ...(filters.ativo !== undefined && { ativo: filters.ativo }),
      },
      include: { municipio: { select: { id: true, nome: true, uf: true } } },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(id: string) {
    const secretaria = await this.prisma.secretaria.findUnique({
      where: { id },
      include: {
        municipio: { select: { id: true, nome: true, uf: true } },
        diretorias: { where: { ativo: true }, orderBy: { nome: 'asc' } },
      },
    });
    if (!secretaria) throw new NotFoundException('Secretaria não encontrada');
    return secretaria;
  }

  async create(dto: CreateSecretariaDto) {
    // Município fixo: Oriximiná - PA
    const municipio = await this.prisma.municipio.findFirst({
      where: { ibge_code: '1505304' },
    });
    if (!municipio) throw new Error('Município Oriximiná-PA não encontrado no banco');

    const { municipio_id: _id, municipio_nome: _n, municipio_uf: _u, ...rest } = dto;
    return this.prisma.secretaria.create({
      data: { ...rest, municipio_id: municipio.id },
    });
  }

  async update(id: string, dto: UpdateSecretariaDto, user: CurrentUser) {
    await this.assertExists(id);
    this.assertOwnership(id, user);
    return this.prisma.secretaria.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: CurrentUser) {
    await this.assertExists(id);
    this.assertOwnership(id, user);
    return this.prisma.secretaria.update({
      where: { id },
      data: { ativo: false },
    });
  }

  private async assertExists(id: string) {
    const s = await this.prisma.secretaria.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Secretaria não encontrada');
    return s;
  }

  private assertOwnership(id: string, user: CurrentUser) {
    const adminRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];
    if (adminRoles.includes(user.role)) return;
    if (user.secretaria_id !== id)
      throw new ForbiddenException('Sem permissão para esta secretaria');
  }
}
