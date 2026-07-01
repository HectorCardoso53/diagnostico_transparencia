import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { PesquisasService } from './pesquisas.service';
import { CreatePesquisaDto } from './dto/create-pesquisa.dto';
import { UpdatePesquisaDto } from './dto/update-pesquisa.dto';
import { ResponderPesquisaDto } from './dto/responder-pesquisa.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('pesquisas')
export class PesquisasController {
  constructor(private service: PesquisasService) {}

  /* ── Endpoints públicos (sem JWT) ── */

  @Get('publica/:id')
  findPublic(@Param('id') id: string) {
    return this.service.findPublic(id);
  }

  @Post(':id/responder')
  @HttpCode(HttpStatus.CREATED)
  responder(@Param('id') id: string, @Body() dto: ResponderPesquisaDto) {
    return this.service.responder(id, dto);
  }

  /* ── Endpoints admin (JWT obrigatório) ── */

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePesquisaDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdatePesquisaDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/publicar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  publicar(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.publicar(id, user);
  }

  @Post(':id/encerrar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  encerrar(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.encerrar(id, user);
  }

  @Get(':id/resultados')
  @UseGuards(JwtAuthGuard)
  resultados(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.getResultados(id, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }
}
