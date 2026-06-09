import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";

// biome-ignore lint/style/noNonNullAssertion: This variable should be present, else everything's broken
export const db = drizzle(process.env.DATABASE_URL!);
