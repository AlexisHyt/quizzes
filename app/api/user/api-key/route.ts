import { headers } from "next/headers";
import { auth } from "@/auth";
import { getUserApiKeyState, regenerateUserApiKey } from "@/lib/api-keys";

export async function GET() {
  try {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({
      headers: requestHeaders,
    });

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKeyState = await getUserApiKeyState(session.user.id);
    return Response.json(apiKeyState);
  } catch (error) {
    console.error("Error fetching user API key:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({
      headers: requestHeaders,
    });

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = await regenerateUserApiKey(session.user.id, requestHeaders);

    return Response.json({
      hasApiKey: true,
      apiKey,
    });
  } catch (error) {
    console.error("Error regenerating user API key:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

