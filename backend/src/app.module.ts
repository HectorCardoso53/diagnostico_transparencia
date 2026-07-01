import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { SecretariasModule } from './secretarias/secretarias.module';
import { DiretoriasModule } from './diretorias/diretorias.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { FormulariosModule } from './formularios/formularios.module';
import { RespostasModule } from './respostas/respostas.module';
import { PesquisasModule } from './pesquisas/pesquisas.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    AuditModule,
    AuthModule,
    SecretariasModule,
    DiretoriasModule,
    UsuariosModule,
    FormulariosModule,
    RespostasModule,
    PesquisasModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}