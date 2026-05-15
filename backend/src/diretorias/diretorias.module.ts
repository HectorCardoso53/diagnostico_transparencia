import { Module } from '@nestjs/common';
import { DiretoriasService } from './diretorias.service';
import { DiretoriasController } from './diretorias.controller';

@Module({
  controllers: [DiretoriasController],
  providers: [DiretoriasService],
})
export class DiretoriasModule {}
