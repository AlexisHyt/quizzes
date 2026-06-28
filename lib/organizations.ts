import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  invitation,
  member,
  organization,
  quizzes,
  session as sessionTable,
  user,
} from "@/drizzle/schema";

export type OrganizationSession = {
  session?: {
    activeOrganizationId?: string | null;
  };
  user: {
    id: string;
    email: string;
    name: string;
    role?: string | null;
  };
};

export async function getUserOrganizations(userId: string) {
  return db
    .select({
      organizationId: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      metadata: organization.metadata,
      createdAt: organization.createdAt,
      memberRole: member.role,
      memberCreatedAt: member.createdAt,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .orderBy(desc(organization.createdAt));
}

export async function getOrganizationMembers(organizationId: string) {
  return db
    .select({
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
      userName: user.name,
      userEmail: user.email,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId))
    .orderBy(asc(member.createdAt));
}

export async function getOrganizationInvitations(organizationId: string) {
  return db
    .select({
      id: invitation.id,
      email: invitation.email,
      inviterId: invitation.inviterId,
      organizationId: invitation.organizationId,
      role: invitation.role,
      status: invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      organizationName: organization.name,
      organizationSlug: organization.slug,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(eq(invitation.organizationId, organizationId))
    .orderBy(desc(invitation.createdAt));
}

export async function getPendingInvitationsForUser(email: string) {
  return db
    .select({
      id: invitation.id,
      email: invitation.email,
      inviterId: invitation.inviterId,
      organizationId: invitation.organizationId,
      role: invitation.role,
      status: invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      organizationName: organization.name,
      organizationSlug: organization.slug,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(and(eq(invitation.email, email), eq(invitation.status, "pending")))
    .orderBy(desc(invitation.createdAt));
}

export async function getActiveOrganizationForSession(
  session: OrganizationSession | null,
) {
  if (!session) {
    return null;
  }

  const activeOrganizationId = session.session?.activeOrganizationId ?? null;
  if (activeOrganizationId) {
    const [activeOrganization] = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        metadata: organization.metadata,
        createdAt: organization.createdAt,
      })
      .from(organization)
      .where(eq(organization.id, activeOrganizationId))
      .limit(1);

    if (activeOrganization) {
      return activeOrganization;
    }
  }

  const organizations = await getUserOrganizations(session.user.id);
  return organizations[0]
    ? {
        id: organizations[0].organizationId,
        name: organizations[0].name,
        slug: organizations[0].slug,
        logo: organizations[0].logo,
        metadata: organizations[0].metadata,
        createdAt: organizations[0].createdAt,
      }
    : null;
}

export async function getOrganizationMembership(
  userId: string,
  organizationId: string,
) {
  const [membership] = await db
    .select({
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
    })
    .from(member)
    .where(
      and(eq(member.userId, userId), eq(member.organizationId, organizationId)),
    )
    .limit(1);

  return membership ?? null;
}

export async function isOrganizationAdmin(
  userId: string,
  organizationId: string,
) {
  const membership = await getOrganizationMembership(userId, organizationId);
  return membership ? ["owner", "admin"].includes(membership.role) : false;
}

export async function getOrganizationById(organizationId: string) {
  const [org] = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
      metadata: organization.metadata,
      createdAt: organization.createdAt,
    })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  return org ?? null;
}

export async function getOrganizationQuizIds(organizationId: string) {
  return db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(eq(quizzes.organizationId, organizationId))
    .orderBy(desc(quizzes.endAt));
}

export async function getOrganizationQuizById(
  organizationId: string,
  quizId: number,
) {
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(
      and(eq(quizzes.id, quizId), eq(quizzes.organizationId, organizationId)),
    )
    .limit(1);

  return quiz ?? null;
}

export async function ensureUserIsMemberOfOrganization(
  userId: string,
  organizationId: string,
) {
  return getOrganizationMembership(userId, organizationId);
}

export async function updateActiveOrganizationSession(
  userId: string,
  organizationId: string | null,
) {
  await db
    .update(sessionTable)
    .set({ activeOrganizationId: organizationId })
    .where(eq(sessionTable.userId, userId));
}
