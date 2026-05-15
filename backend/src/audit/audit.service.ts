import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '../generated/prisma/enums';

interface LogParams {
  user_id?: string;
  action: AuditAction;
  entidade: string;
  entidade_id?: string;
  payload?: unknown;
  ip?: string;
  user_agent?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: LogParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        user_id: params.user_id ?? null,
        action: params.action,
        entidade: params.entidade,
        entidade_id: params.entidade_id ?? null,
        payload: (params.payload ?? null) as any,
        ip: params.ip ?? null,
        user_agent: params.user_agent ?? null,
      },
    });
  }
}
