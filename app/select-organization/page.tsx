import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  selectOrganizationAndGoAction,
} from "@/app/organizations/actions";
import { auth } from "@/auth";
import { getUserOrganizations } from "@/lib/organizations";

export default async function SelectOrganizationPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }

  // Si une organisation est déjà active, aller directement au quiz
  if (session.session?.activeOrganizationId) {
    redirect("/quiz");
  }

  const organizations = await getUserOrganizations(session.user.id);

  // Pas encore membre d'une organisation → aller créer/rejoindre
  if (organizations.length === 0) {
    redirect("/organizations");
  }

  // Une seule organisation : auto-sélection côté serveur via un formulaire auto-soumis
  // (géré côté client ci-dessous pour éviter une redirection intermédiaire)

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#e7e0d8] px-6 py-10 text-[#1f3e68]">
      <main className="w-full max-w-md rounded-2xl border border-[#e4dfda] bg-[#f6f6f6] p-8 shadow-[0_16px_40px_rgba(22,26,29,0.12)]">
        <p className="text-xs font-semibold tracking-[0.22em] text-[#e5533b] uppercase">
          Bienvenue
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1d3d68]">
          Choisir une organisation
        </h1>
        <p className="mt-3 text-base leading-7 text-[#4b6484]">
          Sélectionne l'organisation avec laquelle tu veux travailler.
        </p>

        <div className="mt-8 space-y-3">
          {organizations.map((org) => (
            <form key={org.organizationId} action={selectOrganizationAndGoAction}>
              <input type="hidden" name="organizationId" value={org.organizationId} />
              <button
                type="submit"
                className="w-full rounded-xl border border-[#d9d4cf] bg-white px-5 py-4 text-left transition hover:border-[#1d3d68] hover:bg-[#eef3ff] cursor-pointer"
              >
                <p className="font-semibold text-[#1d3d68]">{org.name}</p>
                <p className="mt-0.5 text-sm text-[#4b6484]">{org.slug}</p>
                <p className="mt-0.5 text-xs text-[#4b6484]">
                  Rôle : {org.memberRole}
                </p>
              </button>
            </form>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-[#4b6484]">
          Tu veux créer ou rejoindre une organisation ?{" "}
          <a
            href="/organizations"
            className="font-semibold text-[#1d3d68] underline underline-offset-4 hover:text-[#e5533b]"
          >
            Gérer mes organisations
          </a>
        </p>
      </main>
    </div>
  );
}

