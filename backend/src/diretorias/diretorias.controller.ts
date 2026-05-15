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
import { DiretoriasService } from './diretorias.service';
import { CreateDiretoriaDto } from './dto/create-diretoria.dto';
import { UpdateDiretoriaDto } from './dto/update-diretoria.dto';

interface AuthUser {
  id: string;
  role: Role;
  secretaria_id: string | null;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('diretorias')
export class DiretoriasController {
  constructor(private service: DiretoriasService) {}

  @Get()
  findAll(
    @Query('secretaria_id') secretaria_id?: string,
    @Query('nome') nome?: string,
    @Query('ativo') ativo?: string,
  ) {
    return this.service.findAll({
      secretaria_id,
      nome,
      ativo: ativo === undefined ? undefined : ativo === 'true',
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO)
  create(@Body() dto: CreateDiretoriaDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDiretoriaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
