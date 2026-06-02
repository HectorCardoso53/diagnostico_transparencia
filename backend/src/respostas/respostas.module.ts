import { Module } from '@nestjs/common';
import { RespostasService } from './respostas.service';
import { RespostasController } from './respostas.controller';
import { UploadsController } from '../uploads.controller';

@Module({
  controllers: [RespostasController, UploadsController],
  providers: [RespostasService],
})
export class RespostasModule {}
