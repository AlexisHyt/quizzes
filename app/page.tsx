import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginCard } from "@/app/login-card";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    // Organisation déjà active → aller directement au quiz
    if (session.session?.activeOrganizationId) {
      redirect("/quiz");
    }
    // Pas d'organisation active → sélecteur à la connexion
    redirect("/select-organization");
  }

  return <LoginCard />;
}
