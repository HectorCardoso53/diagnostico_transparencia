import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { FormStatus, Role } from '../generated/prisma/enums';
import { FormulariosService } from './formularios.service';
import { CreateFormularioDto } from './dto/create-formulario.dto';
import { UpdateFormularioDto } from './dto/update-formulario.dto';
import { AtribuirFormularioDto } from './dto/atribuir-formulario.dto';

interface AuthUser {
  id: string;
  role: Role;
  secretaria_id: string | null;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('formularios')
export class FormulariosController {
  constructor(private service: FormulariosService) {}

  @Get()
  findAll(
    @Query('secretaria_id') secretaria_id?: string,
    @Query('diretoria_id') diretoria_id?: string,
    @Query('status') status?: FormStatus,
    @Query('titulo') titulo?: string,
  ) {
    return this.service.findAll({ secretaria_id, diretoria_id, status, titulo });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO)
  create(@Body() dto: CreateFormularioDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFormularioDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/publicar')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO)
  publicar(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.publicar(id, user);
  }

  @Post(':id/arquivar')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO)
  arquivar(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.arquivar(id, user);
  }

  @Get(':id/versoes')
  getVersoes(@Param('id') id: string) {
    return this.service.getVersoes(id);
  }

  @Post(':id/atribuicoes')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO)
  atribuir(
    @Param('id') id: string,
    @Body() dto: AtribuirFormularioDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.atribuir(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }

  @Delete(':id/atribuicoes/:diretoriaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO)
  removerAtribuicao(
    @Param('id') id: string,
    @Param('diretoriaId') diretoriaId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.removerAtribuicao(id, diretoriaId, user);
  }
}
