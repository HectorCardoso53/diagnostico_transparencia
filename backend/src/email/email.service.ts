import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const port = Number(config.get('SMTP_PORT') ?? 587);
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');

    this.logger.log(`SMTP config → host=${host} port=${port} user=${user} pass=${pass ? '***configurado***' : 'VAZIO'}`);

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });
      this.logger.log('Transporter SMTP criado com sucesso');
    } else {
      this.logger.warn('SMTP não configurado — e-mails não serão enviados. Defina SMTP_HOST, SMTP_USER e SMTP_PASS no .env');
    }
  }

  async sendRecuperacaoSenha(nome: string, email: string, novaSenha: string): Promise<void> {
    if (!this.transporter) return;
    const from = this.config.get<string>('SMTP_FROM') ?? this.config.get<string>('SMTP_USER');
    const link = 'https://diagnostico.oriximina.pa.gov.br/';
    const html = `
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#1a3a5c;padding:32px 40px;text-align:center;">
            <img src="${link}img/prefeitura.png" alt="Logo Prefeitura" width="64" height="64" style="border-radius:8px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />
            <p style="margin:0;color:#94a3b8;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Prefeitura de Oriximiná</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:700;">Sistema de Diagnóstico das Secretarias</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;color:#1e293b;font-size:16px;">Olá, <strong>${nome}</strong>!</p>
            <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">
              Sua senha foi redefinida. Use as credenciais abaixo para acessar o sistema.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 12px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Suas credenciais</p>
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#64748b;font-size:13px;padding:4px 0;width:60px;">E-mail:</td>
                    <td style="color:#1e293b;font-size:13px;font-weight:600;padding:4px 0;">${email}</td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;font-size:13px;padding:4px 0;">Senha:</td>
                    <td style="color:#1e293b;font-size:13px;font-weight:600;padding:4px 0;font-family:monospace;">${novaSenha}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:6px;">
                  Acessar o sistema
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">Este é um e-mail automático — não responda a esta mensagem.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
    try {
      await this.transporter.sendMail({ from, to: email, subject: 'Redefinição de senha — Sistema de Diagnóstico', html });
    } catch (err) {
      const error = err as Error;
      this.logger.error(`FALHA ao enviar e-mail de recuperação para ${email}: ${error.message}`);
    }
  }

  async sendBoasVindas(nome: string, email: string, senha: string): Promise<void> {
    if (!this.transporter) return;

    const from = this.config.get<string>('SMTP_FROM') ?? this.config.get<string>('SMTP_USER');
    const link = 'https://diagnostico.oriximina.pa.gov.br/';

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Cabeçalho -->
        <tr>
          <td style="background:#1a3a5c;padding:32px 40px;text-align:center;">
            <img src="https://diagnostico.oriximina.pa.gov.br/img/prefeitura.png" alt="Logo Prefeitura" width="64" height="64" style="border-radius:8px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />
            <p style="margin:0;color:#94a3b8;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Prefeitura de Oriximiná</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:700;">Sistema de Diagnóstico das Secretarias</h1>
          </td>
        </tr>

        <!-- Corpo -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;color:#1e293b;font-size:16px;">Olá, <strong>${nome}</strong>!</p>
            <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">
              Bem-vindo ao Sistema de Diagnóstico das Secretarias. Use o sistema com seu login e senha cadastrados.
            </p>

            <!-- Login -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 12px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Seu login</p>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#64748b;font-size:13px;padding:4px 0;width:60px;">E-mail:</td>
                      <td style="color:#1e293b;font-size:13px;font-weight:600;padding:4px 0;">${email}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Botão -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:6px;">
                    Acessar o sistema
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Rodapé -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;">
              Este é um e-mail automático — não responda a esta mensagem.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    this.logger.log(`Tentando enviar e-mail para ${email} via ${this.config.get('SMTP_HOST')}`);
    try {
      const info = await this.transporter.sendMail({
        from,
        to: email,
        subject: 'Acesso ao Sistema de Diagnóstico das Secretarias — Oriximiná',
        html,
      });
      this.logger.log(`E-mail enviado com sucesso para ${email} — messageId: ${info.messageId}`);
    } catch (err) {
      const error = err as Error & { code?: string; response?: string };
      this.logger.error(`FALHA ao enviar e-mail para ${email}`);
      this.logger.error(`  code: ${error.code ?? 'n/a'}`);
      this.logger.error(`  message: ${error.message}`);
      this.logger.error(`  response: ${error.response ?? 'n/a'}`);
    }
  }
}
