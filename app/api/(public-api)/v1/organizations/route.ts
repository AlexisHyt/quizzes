import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { member } from "@/drizzle/schema";
import { getUserOrganizations } from "@/lib/organizations";
import { verifyIncomingApiKey } from "@/lib/api-keys";

const PUBLIC_API_ROLES = ["admin", "developer"] as const;

async function getApiKeyUserIdFromRequest(request: Request): Promise<string | null> {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return null;
  }

  const verification = await verifyIncomingApiKey(apiKey);
  if (!verification.valid || !verification.referenceId) {
    return null;
  }

  return verification.referenceId;
}

export async function GET(request: Request) {
  try {
    const userId = await getApiKeyUserIdFromRequest(request);
    if (!userId) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }

    const [allowedMembership] = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.userId, userId),
          inArray(member.role, [...PUBLIC_API_ROLES]),
        ),
      )
      .limit(1);

    if (!allowedMembership) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const organizations = await getUserOrganizations(userId);

    return Response.json({
      organizations: organizations.map((org) => ({
        id: org.organizationId,
        name: org.name,
        slug: org.slug,
        role: org.memberRole,
      })),
    });
  } catch (error) {
    console.error("Error fetching public API organizations:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}


