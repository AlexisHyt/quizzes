import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { TopNavbar } from "@/app/top-navbar";
import { auth } from "@/auth";
import {
  getActiveOrganizationForSession,
  getOrganizationMembership,
  type OrganizationSession,
} from "@/lib/organizations";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quiz Qualite",
  description: "Quiz hebdomadaire avec connexion Google",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth.api.getSession({ headers: await headers() });
  const organizationSession: OrganizationSession | null = session
    ? {
        session: {
          activeOrganizationId: session.session?.activeOrganizationId ?? null,
        },
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: session.user.role,
        },
      }
    : null;
  const activeOrganization = organizationSession
    ? await getActiveOrganizationForSession(organizationSession)
    : null;
  const membership = session && activeOrganization
    ? await getOrganizationMembership(session.user.id, activeOrganization.id)
    : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {session ? (
          <TopNavbar
            user={{ name: session.user.name, email: session.user.email }}
            activeOrganizationName={activeOrganization?.name ?? null}
            canAccessAdmin={
              !!membership && ["owner", "admin"].includes(membership.role)
            }
          />
        ) : null}
        {children}
      </body>
    </html>
  );
}
