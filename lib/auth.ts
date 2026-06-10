import { betterAuth } from "better-auth";
import { db } from "./db";

const DEV_FALLBACK_SECRET = "replace-this-dev-secret-before-production-32-chars";

export const auth = betterAuth({
  appName: "IELTS Writing Checker",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET || DEV_FALLBACK_SECRET,
  database: db,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true
  }
});
