import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM || "DTAN Learn <onboarding@resend.dev>";

// Lazily instantiated: the Resend SDK throws immediately if the API key is
// missing/empty, and constructing it at module scope would crash the build
// (and any route that merely imports this file) whenever RESEND_API_KEY
// isn't set yet — e.g. during local dev before secrets are configured.
let client: Resend | null = null;
function getClient(): Resend {
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

export async function sendPasswordResetCodeEmail(to: string, code: string): Promise<void> {
  await getClient().emails.send({
    from: FROM,
    to,
    subject: "Your DTAN Learn password reset code",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#2e7d32;">DTAN Learn</h2>
        <p>Use the code below to reset your password:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #f1f8f2; border-radius: 8px; color:#2e7d32;">${code}</p>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p style="color:#64748b; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}
