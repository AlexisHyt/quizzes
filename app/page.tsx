import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginCard } from "@/app/login-card";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/quiz");
  }

  return <LoginCard />;
}
