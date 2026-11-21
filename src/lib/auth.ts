import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { getDb } from "./db";
import { sendVerificationEmail } from "./email";

function checkEmail(email: string) {
  if (email.slice(email.lastIndexOf("@") + 1).toLowerCase() !== "usth.edu.vn") {
    throw new APIError("BAD_REQUEST", { message: "Vui lòng dùng email @usth.edu.vn" });
  }
  return email.toLowerCase();
}

function createAuth() {
  const baseURL = process.env.BETTER_AUTH_URL;
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!baseURL || !secret || secret.length < 32) throw new Error("Missing Better Auth URL or secret");
  return betterAuth({
    baseURL, secret, trustedOrigins: [new URL(baseURL).origin],
    database: prismaAdapter(getDb(), { provider: "postgresql", transaction: true }),
    advanced: { database: { generateId: () => crypto.randomUUID() } },
    emailAndPassword: { enabled: true, requireEmailVerification: true, minPasswordLength: 12, maxPasswordLength: 128 },
    emailVerification: {
      sendOnSignUp: true, autoSignInAfterVerification: false, expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => sendVerificationEmail(user.email, url),
    },
    session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 60, cookieCache: { enabled: false } },
    user: { additionalFields: {
      role: { type: ["REPORTER", "STAFF", "MANAGER"], required: false, defaultValue: "REPORTER", input: false },
      locale: { type: "string", required: false, defaultValue: "vi", input: false },
    } },
    databaseHooks: { user: {
      create: { before: async (user) => ({ data: { ...user, email: checkEmail(user.email), role: "REPORTER", emailVerified: false } }) },
      update: { before: async (user) => ({ data: { ...user, ...(user.email ? { email: checkEmail(user.email) } : {}) } }) },
    } },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(); }
