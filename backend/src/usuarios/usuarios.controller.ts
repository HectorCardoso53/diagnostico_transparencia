import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../generated/prisma/enums';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

interface AuthUser {
  id: string;
  role: Role;
  secretaria_id: string | null;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private service: UsuariosService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO)
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('role') role?: Role,
    @Query('secretaria_id') secretaria_id?: string,
    @Query('diretoria_id') diretoria_id?: string,
    @Query('nome') nome?: string,
    @Query('ativo') ativo?: string,
  ) {
    return this.service.findAll(
      {
        role,
        secretaria_id,
        diretoria_id,
        nome,
        ativo: ativo === undefined ? undefined : ativo === 'true',
      },
      user,
    );
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() dto: CreateUsuarioDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUsuarioDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/reenviar-acesso')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  reenviarAcesso(@Param('id') id: string) {
    return this.service.reenviarAcesso(id);
  }
}
