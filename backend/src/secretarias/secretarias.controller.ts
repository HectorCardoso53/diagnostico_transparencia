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
import { SecretariasService } from './secretarias.service';
import { CreateSecretariaDto } from './dto/create-secretaria.dto';
import { UpdateSecretariaDto } from './dto/update-secretaria.dto';

interface AuthUser {
  id: string;
  role: Role;
  secretaria_id: string | null;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('secretarias')
export class SecretariasController {
  constructor(private service: SecretariasService) {}

  @Get()
  findAll(
    @Query('nome') nome?: string,
    @Query('municipio_id') municipio_id?: string,
    @Query('sigla') sigla?: string,
    @Query('ativo') ativo?: string,
  ) {
    return this.service.findAll({
      nome,
      municipio_id,
      sigla,
      ativo: ativo === undefined ? undefined : ativo === 'true',
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  create(@Body() dto: CreateSecretariaDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSecretariaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
