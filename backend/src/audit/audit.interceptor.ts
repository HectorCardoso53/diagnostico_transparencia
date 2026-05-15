import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditAction } from '../generated/prisma/enums';
import { AuditService } from './audit.service';

const ENTITY_MAP: Record<string, string> = {
  secretarias: 'Secretaria',
  diretorias: 'Diretoria',
  usuarios: 'User',
  formularios: 'FormSchema',
  respostas: 'FormResponse',
};

const METHOD_ACTION: Record<string, AuditAction> = {
  POST: AuditAction.CREATE,
  PUT: AuditAction.UPDATE,
  PATCH: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      params: Record<string, string>;
      body: unknown;
      headers: Record<string, string>;
      ip: string;
      user?: { id: string };
    }>();

    const action = METHOD_ACTION[req.method];
    if (!action || req.url.includes('/auth/')) return next.handle();

    return next.handle().pipe(
      tap((response: unknown) => {
        const segments = req.url.split('?')[0].split('/').filter(Boolean);
        const routeKey = segments[1] ?? segments[0]; // pula 'api'
        const entity = ENTITY_MAP[routeKey] ?? routeKey;
        const entityId =
          req.params?.id ?? (response as Record<string, string> | null)?.id;

        this.auditService
          .log({
            user_id: req.user?.id,
            action,
            entidade: entity,
            entidade_id: entityId,
            payload: req.method !== 'DELETE' ? req.body : undefined,
            ip: req.ip,
            user_agent: req.headers['user-agent'],
          })
          .catch(() => {});
      }),
    );
  }
}
