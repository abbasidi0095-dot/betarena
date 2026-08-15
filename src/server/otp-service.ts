import { prisma } from "@/lib/db";
import { generateOtp, hashOtp, OTP_LIFETIME_MS } from "@/lib/otp";
import { sendEmail, otpEmailHtml } from "@/lib/email";

/**
 * Create a fresh OTP for the user and email it. Any previous OTP rows for
 * the user are replaced (one active code per user). Logs the code to the
 * server console as a fallback for local testing.
 */
export async function issueOtp(userId: string, email: string): Promise<string> {
  const code = generateOtp();
  await prisma.otp.deleteMany({ where: { userId } });
  await prisma.otp.create({
    data: {
      userId,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_LIFETIME_MS),
    },
  });
  const minutes = Math.round(OTP_LIFETIME_MS / 60_000);
  const result = await sendEmail({
    to: email,
    subject: "Your Abbet verification code",
    html: otpEmailHtml(code, minutes),
  });
  if (!result.sent) {
    console.log(`[otp] ${email} — code ${code} (email not delivered: ${result.reason})`);
  }
  return code;
}
