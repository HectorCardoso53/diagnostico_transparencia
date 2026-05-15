import { Module } from '@nestjs/common';
import { SecretariasService } from './secretarias.service';
import { SecretariasController } from './secretarias.controller';

@Module({
  controllers: [SecretariasController],
  providers: [SecretariasService],
})
export class SecretariasModule {}
