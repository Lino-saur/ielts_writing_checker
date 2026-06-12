import { betterAuth } from "better-auth";
import { db } from "./db";
import { sendEmail } from "./email";

function buildVerificationEmail(name: string | null | undefined, url: string) {
  const displayName = name?.trim() || "there";
  const subject = "Verify your email for IELTS Writing Checker";
  const text = [
    `Hi ${displayName},`,
    "",
    "Please verify your email address to continue using IELTS Writing Checker.",
    `Verification link: ${url}`,
    "",
    "If you did not create this account, you can ignore this email."
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <p>Hi ${displayName},</p>
      <p>Please verify your email address to continue using IELTS Writing Checker.</p>
      <p>
        <a
          href="${url}"
          style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;"
        >
          Verify Email
        </a>
      </p>
      <p style="word-break: break-all;">If the button does not work, open this link directly:<br />${url}</p>
      <p>If you did not create this account, you can ignore this email.</p>
    </div>
  `;

  return { subject, text, html };
}

export const auth = betterAuth({
  appName: "IELTS Writing Checker",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: db,
  user: {
    deleteUser: {
      enabled: true,
      async beforeDelete(user) {
        const client = await db.connect();

        try {
          await client.query("BEGIN");
          await client.query("DELETE FROM admin_users WHERE auth_user_id = $1", [user.id]);
          await client.query("DELETE FROM feedback_entries WHERE user_id = $1", [user.id]);
          await client.query("DELETE FROM energy_transactions WHERE user_id = $1", [user.id]);
          await client.query("DELETE FROM energy_accounts WHERE user_id = $1", [user.id]);
          await client.query("DELETE FROM recharge_orders WHERE user_id = $1", [user.id]);
          await client.query("DELETE FROM writing_reviews WHERE user_id = $1", [user.id]);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      }
    }
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    async sendVerificationEmail({ user, url }) {
      const email = buildVerificationEmail(user.name, url);
      await sendEmail({
        to: user.email,
        subject: email.subject,
        html: email.html,
        text: email.text
      });
    }
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true
  }
});
