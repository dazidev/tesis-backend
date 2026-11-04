import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class BrevoService {
  private readonly logger = new Logger(BrevoService.name);
  private readonly transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: this.configService.getOrThrow<string>('BREVO_EMAIL'),
        pass: this.configService.getOrThrow<string>('BREVO_SMTP_PASS'),
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    const senderName =
      this.configService.getOrThrow<string>('BREVO_SENDER_NAME');

    const senderEmail =
      this.configService.getOrThrow<string>('BREVO_SENDER_EMAIL');

    try {
      const info = await this.transporter.sendMail({
        from: {
          name: senderName,
          address: senderEmail,
        },
        to,
        subject,
        html,
      });

      this.logger.log(`Correo enviado: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error('Error al enviar correo con Brevo', error);
      return false;
    }
  }
}
