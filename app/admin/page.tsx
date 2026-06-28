import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminQuizzesManager } from "@/app/admin/quizzes-manager";
import { AdminResponsesViewer } from "@/app/admin/responses-viewer";
import { auth } from "@/auth";
import {
  getActiveOrganizationForSession,
  getOrganizationMembership,
  type OrganizationSession,
} from "@/lib/organizations";

export default async function AdminResponsesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Rediriger si l'utilisateur n'est pas connecté
  if (!session) {
    redirect("/");
  }

  const organizationSession: OrganizationSession = {
    session: {
      activeOrganizationId: session.session?.activeOrganizationId ?? null,
    },
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    },
  };

  const activeOrganization =
    await getActiveOrganizationForSession(organizationSession);
  if (!activeOrganization) {
    redirect("/organizations");
  }

  const membership = await getOrganizationMembership(
    session.user.id,
    activeOrganization.id,
  );

  // Rediriger si l'utilisateur n'est pas admin de l'organisation active
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    redirect("/quiz");
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#e7e0d8] px-6 py-10 text-[#1f3e68]">
      <main className="w-full max-w-6xl rounded-2xl border border-[#e4dfda] bg-[#f6f6f6] p-8 shadow-[0_16px_40px_rgba(22,26,29,0.12)] sm:p-10">
        <p className="text-xs font-semibold tracking-[0.22em] text-[#e5533b] uppercase">
          Tableau de bord admin
        </p>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#1d3d68]">
          Gestion des quizzes
        </h1>

        <p className="mt-4 text-lg leading-8 text-[#4b6484]">
          Crée, modifie et organise les questions et réponses de tes quizzes,
          puis consulte les tentatives des utilisateurs.
        </p>

        <section className="mt-8">
          <AdminQuizzesManager />
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold tracking-tight text-[#1d3d68]">
            Réponses des utilisateurs
          </h2>
          <p className="mt-2 text-sm text-[#4b6484]">
            Vue d&apos;ensemble des réponses et tentatives classées par quiz.
          </p>

          <div className="mt-4">
            <AdminResponsesViewer />
          </div>
        </section>

      </main>
    </div>
  );
}
