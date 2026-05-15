import {
  Body,
  Controller,
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
import { ResponseStatus, Role } from '../generated/prisma/enums';
import { RespostasService } from './respostas.service';
import { CreateRespostaDto } from './dto/create-resposta.dto';
import { RevisarRespostaDto } from './dto/revisar-resposta.dto';

interface AuthUser {
  id: string;
  role: Role;
  secretaria_id: string | null;
  diretoria_id: string | null;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('respostas')
export class RespostasController {
  constructor(private service: RespostasService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('form_id') form_id?: string,
    @Query('diretoria_id') diretoria_id?: string,
    @Query('status') status?: ResponseStatus,
  ) {
    return this.service.findAll({ form_id, diretoria_id, status }, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateRespostaDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.OPERADOR, Role.DIRETOR, Role.SECRETARIO, Role.ADMIN, Role.SUPER_ADMIN)
  updateRascunho(
    @Param('id') id: string,
    @Body() body: { dados_json: Record<string, unknown> },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateRascunho(id, body.dados_json, user);
  }

  @Post(':id/enviar')
  enviar(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.enviar(id, user);
  }

  @Post(':id/revisar')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SECRETARIO, Role.DIRETOR)
  revisar(
    @Param('id') id: string,
    @Body() dto: RevisarRespostaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.revisar(id, dto, user);
  }
}
