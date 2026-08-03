import nodemailer, { Transporter } from "nodemailer";

import { config } from "../config";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

/**
 * Fire-and-forget email send. Failures (including SMTP not configured) are
 * logged, never thrown - an email outage must not break the escalation/
 * assignment flow that triggered it.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const client = getTransporter();
  if (!client) {
    console.warn("SMTP not configured - skipping email send");
    return;
  }
  try {
    await client.sendMail({ from: config.smtp.from, to, subject, text });
  } catch (err) {
    console.error("Failed to send notification email:", err);
  }
}
