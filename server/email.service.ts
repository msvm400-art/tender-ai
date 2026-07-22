import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || ""
  }
});

export async function sendAlertEmail(to: string, subject: string, body: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[Email Service (Mock / Missing Credentials)] Alert Email details:
To: ${to}
Subject: ${subject}
Body: ${body}
----------------------------------------`);
    return;
  }
  
  try {
    await transporter.sendMail({
      from: `"TenderAI" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: `<div style="font-family: sans-serif; padding: 20px; line-height: 1.6;">${body}</div>`
    });
    console.log(`[Email Service] Alert Email successfully sent to ${to}`);
  } catch (err) {
    console.error(`[Email Service] Failed to send email to ${to}:`, err);
  }
}
