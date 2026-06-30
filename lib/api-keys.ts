import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/drizzle/db";
import { user } from "@/drizzle/schema";
import { decryptApiKey, encryptApiKey } from "@/lib/api-key-crypto";

export type UserApiKeyState = {
  hasApiKey: boolean;
  apiKey: string | null;
};

export async function getUserApiKeyState(userId: string): Promise<UserApiKeyState> {
  const [currentUser] = await db
    .select({ apiKeyEncrypted: user.apiKeyEncrypted })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!currentUser?.apiKeyEncrypted) {
    return {
      hasApiKey: false,
      apiKey: null,
    };
  }

  return {
    hasApiKey: true,
    apiKey: decryptApiKey(currentUser.apiKeyEncrypted),
  };
}

export async function regenerateUserApiKey(
  userId: string,
  authHeaders: Headers,
): Promise<string> {
  const createdKey = await auth.api.createApiKey({
    headers: authHeaders,
    body: {
      name: "Default API key",
    },
  });

  const listResponse = await auth.api.listApiKeys({
    headers: authHeaders,
  });

  await Promise.all(
    listResponse.apiKeys
      .filter((apiKey) => apiKey.id !== createdKey.id)
      .map((apiKey) =>
        auth.api.deleteApiKey({
          headers: authHeaders,
          body: { keyId: apiKey.id },
        })
      ),
  );

  await db
    .update(user)
    .set({ apiKeyEncrypted: encryptApiKey(createdKey.key) })
    .where(eq(user.id, userId));

  return createdKey.key;
}

export async function verifyIncomingApiKey(apiKey: string) {
  const verification = await auth.api.verifyApiKey({
    body: { key: apiKey },
  });

  return {
    valid: verification.valid,
    referenceId: verification.key?.referenceId ?? null,
  };
}

