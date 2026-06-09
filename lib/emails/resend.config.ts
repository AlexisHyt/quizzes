import { Resend } from "resend";

// biome-ignore lint/style/noNonNullAssertion: Variable present
export const resend = new Resend(process.env.RESEND_API_KEY!);

export const baseEmail = "noreply@alexishayat.me";
