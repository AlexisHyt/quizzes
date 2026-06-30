import { betterAuth } from "better-auth";
import { apiKey } from "@better-auth/api-key";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { db } from "@/drizzle/db";
import * as schema from "@/drizzle/schema";
import { sendOrganizationInvitationEmail } from "@/lib/emails/send-organization-invitation";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  plugins: [
    nextCookies(),
    apiKey({
      defaultPrefix: "qz_",
    }),
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: "admin",
      sendInvitationEmail: async (data, request) => {
        await sendOrganizationInvitationEmail({
          id: data.id,
          email: data.email,
          role: data.role,
          organization: data.organization,
          request,
        });
      },
    }),
  ],
});
