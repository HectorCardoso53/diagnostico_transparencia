import { Module } from '@nestjs/common';
import { PesquisasController } from './pesquisas.controller';
import { PesquisasService } from './pesquisas.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PesquisasController],
  providers: [PesquisasService],
})
export class PesquisasModule {}
