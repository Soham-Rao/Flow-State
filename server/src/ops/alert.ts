import nodemailer from "nodemailer";

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export function isOpsAlertConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.OPS_ALERT_EMAIL_TO);
}

export async function sendOpsAlert(subject: string, message: string): Promise<void> {
  if (!isOpsAlertConfigured()) {
    logger.warn("ops.alert_skipped", {
      subject,
      reason: "missing_ops_alert_configuration"
    });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: env.OPS_ALERT_EMAIL_FROM ?? env.SMTP_FROM,
    to: env.OPS_ALERT_EMAIL_TO,
    subject,
    text: message
  });

  logger.info("ops.alert_sent", {
    subject,
    to: env.OPS_ALERT_EMAIL_TO
  });
}
