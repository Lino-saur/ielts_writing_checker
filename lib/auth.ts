import { betterAuth } from "better-auth";
import { createHash } from "node:crypto";
import { db } from "./db";
import { sendEmail } from "./email";
import { deleteReviewImageObject, isReviewImageStorageConfigured } from "./object-storage";

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
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24
  },
  user: {
    deleteUser: {
      enabled: true,
      async beforeDelete(user) {
        const client = await db.connect();
        const objectKeys = new Set<string>();
        const anonymizedUserId = `deleted_${createHash("sha256").update(user.id).digest("hex").slice(0, 32)}`;

        try {
          await client.query("BEGIN");
          const adminResult = await client.query<{ id: string }>(
            "SELECT id FROM admin_users WHERE auth_user_id = $1",
            [user.id]
          );
          const adminIds = adminResult.rows.map((row) => row.id);
          const reviewImages = await client.query<{ image_object_key: string | null }>(
            "SELECT image_object_key FROM writing_reviews WHERE user_id = $1 AND image_object_key IS NOT NULL",
            [user.id]
          );
          reviewImages.rows.forEach((row) => row.image_object_key && objectKeys.add(row.image_object_key));
          if (adminIds.length > 0) {
            const assignmentImages = await client.query<{ image_object_key: string | null }>(
              "SELECT image_object_key FROM writing_assignments WHERE teacher_admin_user_id = ANY($1::text[]) AND image_object_key IS NOT NULL",
              [adminIds]
            );
            assignmentImages.rows.forEach((row) => row.image_object_key && objectKeys.add(row.image_object_key));
            await client.query("UPDATE assignment_submissions SET reviewed_by_admin_user_id = NULL WHERE reviewed_by_admin_user_id = ANY($1::text[])", [adminIds]);
            await client.query("DELETE FROM writing_classes WHERE teacher_admin_user_id = ANY($1::text[])", [adminIds]);
            await client.query("DELETE FROM writing_assignments WHERE teacher_admin_user_id = ANY($1::text[])", [adminIds]);
          }
          await client.query("DELETE FROM admin_users WHERE auth_user_id = $1", [user.id]);
          await client.query("DELETE FROM feedback_entries WHERE user_id = $1", [user.id]);
          await client.query("DELETE FROM writing_class_students WHERE student_user_id = $1", [user.id]);
          await client.query("DELETE FROM assignment_submissions WHERE student_user_id = $1", [user.id]);
          await client.query("DELETE FROM assignment_recipients WHERE student_user_id = $1", [user.id]);
          await client.query("DELETE FROM writing_review_shares WHERE user_id = $1", [user.id]);
          await client.query("DELETE FROM order_support_requests WHERE user_id = $1", [user.id]);
          await client.query("DELETE FROM unlimited_review_passes WHERE user_id = $1", [user.id]);
          await client.query("DELETE FROM ai_review_requests WHERE user_id = $1", [user.id]);
          await client.query("DELETE FROM energy_transactions WHERE user_id = $1", [user.id]);
          await client.query("DELETE FROM energy_accounts WHERE user_id = $1", [user.id]);
          await client.query("UPDATE recharge_orders SET user_id = $2, updated_at = NOW() WHERE user_id = $1", [user.id, anonymizedUserId]);
          await client.query("DELETE FROM writing_reviews WHERE user_id = $1", [user.id]);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }

        if (objectKeys.size > 0 && isReviewImageStorageConfigured()) {
          const results = await Promise.allSettled([...objectKeys].map((key) => deleteReviewImageObject(key)));
          const failed = results.filter((result) => result.status === "rejected");
          if (failed.length > 0) {
            console.error("[ACCOUNT_DELETE][OBJECT_CLEANUP_FAILED]", {
              userIdHash: anonymizedUserId,
              failedCount: failed.length,
              totalCount: results.length
            });
          }
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
