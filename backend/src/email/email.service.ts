import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const port = config.get<number>('SMTP_PORT') ?? 587;
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      this.logger.warn('SMTP não configurado — e-mails não serão enviados. Defina SMTP_HOST, SMTP_USER e SMTP_PASS no .env');
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
          <td style="background:#0f1b2d;padding:32px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Prefeitura de Oriximiná</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:700;">Sistema de Diagnóstico das Secretarias</h1>
          </td>
        </tr>

        <!-- Corpo -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;color:#1e293b;font-size:16px;">Olá, <strong>${nome}</strong>!</p>
            <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">
              Sua conta foi criada no Sistema de Diagnóstico das Secretarias. Use as credenciais abaixo para acessar o sistema.
            </p>

            <!-- Credenciais -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 12px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Suas credenciais</p>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#64748b;font-size:13px;padding:4px 0;width:60px;">E-mail:</td>
                      <td style="color:#1e293b;font-size:13px;font-weight:600;padding:4px 0;">${email}</td>
                    </tr>
                    <tr>
                      <td style="color:#64748b;font-size:13px;padding:4px 0;">Senha:</td>
                      <td style="color:#1e293b;font-size:13px;font-weight:600;padding:4px 0;font-family:monospace;">${senha}</td>
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

            <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
              Por segurança, recomendamos que você altere sua senha após o primeiro acesso.<br>
              Em caso de dúvidas, entre em contato com o administrador do sistema.
            </p>
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

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: 'Acesso ao Sistema de Diagnóstico das Secretarias — Oriximiná',
        html,
      });
      this.logger.log(`E-mail de boas-vindas enviado para ${email}`);
    } catch (err) {
      this.logger.error(`Falha ao enviar e-mail para ${email}: ${(err as Error).message}`);
    }
  }
}
