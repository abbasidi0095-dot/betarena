const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const DEFAULT_FROM = process.env.OTP_FROM_EMAIL ?? "Abbet <onboarding@resend.dev>";

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

/**
 * Send a transactional email via Resend. When no key is configured the
 * message is logged to the server console instead — the OTP flow still
 * works for local testing.
 */
export async function sendEmail(args: SendEmailArgs): Promise<{ sent: boolean; reason?: string }> {
  if (!RESEND_API_KEY) {
    console.log(`[email] RESEND_API_KEY not configured — not sending "${args.subject}" to ${args.to}`);
    return { sent: false, reason: "not_configured" };
  }

  const body: Record<string, unknown> = {
    from: args.from ?? DEFAULT_FROM,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text ?? args.html.replace(/<[^>]*>/g, ""),
  };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { sent: false, reason: `resend_${res.status}: ${err.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "network" };
  }
}

export function otpEmailHtml(code: string, minutes: number): string {
  return `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="color:#ffc700;margin:0 0 8px">Abbet</h2>
    <p style="color:#333">Your verification code is:</p>
    <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#111;margin:12px 0">${code}</p>
    <p style="color:#666;font-size:13px">Enter this code to verify your email. It expires in ${minutes} minutes. If you didn't request this, you can safely ignore this email.</p>
  </div>`;
}
