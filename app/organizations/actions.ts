"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/drizzle/db";
import {
  invitation,
  member,
  organization,
  session as sessionTable,
} from "@/drizzle/schema";
import { sendOrganizationInvitationEmail } from "@/lib/emails/send-organization-invitation";
import {
  getOrganizationById,
  getOrganizationMembership,
  getUserOrganizations,
} from "@/lib/organizations";
import { slugify } from "@/lib/utils";

function getFirst(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

const ORGANIZATION_ROLES = ["member", "developer", "admin"] as const;

export async function createOrganizationAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }

  const name = getFirst(formData.get("name")).trim();

  if (!name) {
    redirect("/organizations?error=missing-data");
  }

  const slug = slugify(name);

  const organizationId = randomUUID();
  const now = new Date();

  await db.insert(organization).values({
    id: organizationId,
    name,
    slug,
    createdAt: now,
  });

  await db.insert(member).values({
    id: randomUUID(),
    organizationId,
    userId: session.user.id,
    role: "admin",
    createdAt: now,
  });

  await db
    .update(sessionTable)
    .set({ activeOrganizationId: organizationId })
    .where(eq(sessionTable.userId, session.user.id));

  revalidatePath("/organizations");
  redirect("/organizations");
}

export async function setActiveOrganizationAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }

  const organizationId = getFirst(formData.get("organizationId"));
  if (!organizationId) {
    redirect("/organizations");
  }

  const membership = await getOrganizationMembership(
    session.user.id,
    organizationId,
  );
  if (!membership) {
    redirect("/organizations?error=forbidden");
  }

  await db
    .update(sessionTable)
    .set({ activeOrganizationId: organizationId })
    .where(eq(sessionTable.userId, session.user.id));

  revalidatePath("/organizations");
  redirect("/organizations");
}

export async function acceptInvitationAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }

  const invitationId = getFirst(formData.get("invitationId"));
  if (!invitationId) {
    redirect("/organizations");
  }

  const [currentInvitation] = await db
    .select()
    .from(invitation)
    .where(eq(invitation.id, invitationId))
    .limit(1);

  if (!currentInvitation) {
    redirect("/organizations?error=invitation-not-found");
  }

  if (
    currentInvitation.email.toLowerCase() !==
      session.user.email.toLowerCase() ||
    currentInvitation.status !== "pending"
  ) {
    redirect("/organizations?error=invitation-not-found");
  }

  const existingMembership = await getOrganizationMembership(
    session.user.id,
    currentInvitation.organizationId,
  );

  if (!existingMembership) {
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: currentInvitation.organizationId,
      userId: session.user.id,
      role: currentInvitation.role ?? "member",
      createdAt: new Date(),
    });
  }

  await db
    .update(invitation)
    .set({ status: "accepted" })
    .where(eq(invitation.id, invitationId));

  await db
    .update(sessionTable)
    .set({ activeOrganizationId: currentInvitation.organizationId })
    .where(eq(sessionTable.userId, session.user.id));

  revalidatePath("/organizations");
  redirect("/organizations");
}

export async function sendInvitationAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }

  const organizationId = getFirst(formData.get("organizationId"));
  const email = getFirst(formData.get("email")).trim();
  const requestedRole = getFirst(formData.get("role")).trim() || "member";
  const role = ORGANIZATION_ROLES.includes(
    requestedRole as (typeof ORGANIZATION_ROLES)[number],
  )
    ? requestedRole
    : "member";

  if (!organizationId || !email) {
    redirect("/organizations?error=missing-data");
  }

  const membership = await getOrganizationMembership(
    session.user.id,
    organizationId,
  );
  if (!membership || membership.role !== "admin") {
    redirect("/organizations?error=forbidden");
  }

  const org = await getOrganizationById(organizationId);
  if (!org) {
    redirect("/organizations?error=organization-not-found");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 48);
  const invitationId = randomUUID();

  await db.insert(invitation).values({
    id: invitationId,
    email,
    inviterId: session.user.id,
    organizationId,
    role,
    status: "pending",
    createdAt: now,
    expiresAt,
  });

  await sendOrganizationInvitationEmail({
    id: invitationId,
    email,
    role,
    organization: {
      name: org.name,
      slug: org.slug,
    },
  });

  revalidatePath("/organizations");
  redirect("/organizations");
}

export async function leaveOrganizationAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }

  const organizationId = getFirst(formData.get("organizationId"));
  if (!organizationId) {
    redirect("/organizations");
  }

  const membership = await getOrganizationMembership(
    session.user.id,
    organizationId,
  );
  if (!membership) {
    redirect("/organizations?error=forbidden");
  }

  if (membership.role === "admin") {
    const admins = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.role, "admin"),
        ),
      );

    if (admins.length <= 1) {
      redirect("/organizations?error=last-admin");
    }
  }

  await db
    .delete(member)
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, session.user.id),
      ),
    );

  revalidatePath("/organizations");
  const organizations = await getUserOrganizations(session.user.id);
  if (organizations[0]) {
    await db
      .update(sessionTable)
      .set({ activeOrganizationId: organizations[0].organizationId })
      .where(eq(sessionTable.userId, session.user.id));
  }

  redirect("/organizations");
}

export async function deleteOrganizationAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }

  const organizationId = getFirst(formData.get("organizationId"));
  if (!organizationId) {
    redirect("/organizations");
  }

  const membership = await getOrganizationMembership(
    session.user.id,
    organizationId,
  );
  if (!membership || membership.role !== "admin") {
    redirect("/organizations?error=forbidden");
  }

  // Hard delete: la suppression de l'organisation supprime en cascade
  // quizzes, questions, réponses, tentatives, statistiques, membres et
  // invitations (contraintes onDelete: "cascade" du schéma).
  await db.delete(organization).where(eq(organization.id, organizationId));

  // Réinitialise l'organisation active de la session si nécessaire.
  const organizations = await getUserOrganizations(session.user.id);
  await db
    .update(sessionTable)
    .set({ activeOrganizationId: organizations[0]?.organizationId ?? null })
    .where(eq(sessionTable.userId, session.user.id));

  revalidatePath("/organizations");
  redirect("/organizations");
}

export async function switchOrganizationAndGoQuizAction(formData: FormData) {
  return setActiveOrganizationAction(formData);
}

// Utilisée par /select-organization pour choisir une org à la connexion et rediriger vers /quiz
export async function selectOrganizationAndGoAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }

  const organizationId = getFirst(formData.get("organizationId"));
  if (!organizationId) {
    redirect("/select-organization");
  }

  const membership = await getOrganizationMembership(
    session.user.id,
    organizationId,
  );
  if (!membership) {
    redirect("/select-organization?error=forbidden");
  }

  await db
    .update(sessionTable)
    .set({ activeOrganizationId: organizationId })
    .where(eq(sessionTable.userId, session.user.id));

  redirect("/quiz");
}

