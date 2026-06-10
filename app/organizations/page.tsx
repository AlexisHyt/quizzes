import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  acceptInvitationAction,
  createOrganizationAction,
  leaveOrganizationAction,
  sendInvitationAction,
  setActiveOrganizationAction,
} from "@/app/organizations/actions";
import { SignOutButton } from "@/app/quiz/sign-out-button";
import { auth } from "@/auth";
import {
  getActiveOrganizationForSession,
  getOrganizationInvitations,
  getOrganizationMembers,
  getPendingInvitationsForUser,
  getUserOrganizations,
  type OrganizationSession,
} from "@/lib/organizations";

export default async function OrganizationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
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

  const organizations = await getUserOrganizations(session.user.id);
  const activeOrganization =
    await getActiveOrganizationForSession(organizationSession);
  const pendingInvitations = await getPendingInvitationsForUser(
    session.user.email,
  );
  const activeOrganizationId =
    activeOrganization?.id ?? organizations[0]?.organizationId ?? null;
  const members = activeOrganizationId
    ? await getOrganizationMembers(activeOrganizationId)
    : [];
  const invitations = activeOrganizationId
    ? await getOrganizationInvitations(activeOrganizationId)
    : [];

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#e7e0d8] px-6 py-16 text-[#1f3e68]">
      <main className="w-full max-w-6xl space-y-8 rounded-2xl border border-[#e4dfda] bg-[#f6f6f6] p-8 shadow-[0_16px_40px_rgba(22,26,29,0.12)] sm:p-10">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] text-[#e5533b] uppercase">
            Organisations
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#1d3d68]">
            Bonjour {session.user.name}
          </h1>
          <p className="mt-3 text-lg leading-8 text-[#4b6484]">
            Crée ou rejoins une organisation, puis active-en une pour accéder
            aux quizzes.
          </p>
        </div>

        {pendingInvitations.length > 0 ? (
          <section className="rounded-xl border border-[#d9d4cf] bg-white p-5">
            <h2 className="text-lg font-semibold text-[#1d3d68]">
              Invitations en attente
            </h2>
            <div className="mt-4 space-y-3">
              {pendingInvitations.map((inv) => (
                <form
                  key={inv.id}
                  action={acceptInvitationAction}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e4dfda] p-4"
                >
                  <div>
                    <p className="font-semibold text-[#1d3d68]">
                      {inv.organizationName}
                    </p>
                    <p className="text-sm text-[#4b6484]">
                      Rôle proposé : {inv.role}
                    </p>
                    <p className="text-xs text-[#4b6484]">
                      Expire le{" "}
                      {new Date(inv.expiresAt).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <input type="hidden" name="invitationId" value={inv.id} />
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-[#ea553a] px-5 text-sm font-semibold text-white transition hover:bg-[#d84b31] cursor-pointer"
                  >
                    Accepter
                  </button>
                </form>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form
            action={createOrganizationAction}
            className="rounded-xl border border-[#d9d4cf] bg-white p-5 space-y-4"
          >
            <div>
              <h2 className="text-lg font-semibold text-[#1d3d68]">
                Créer une organisation
              </h2>
              <p className="text-sm text-[#4b6484]">
                Le créateur devient propriétaire et peut inviter d’autres
                personnes.
              </p>
            </div>
            <label className="block space-y-2 text-sm font-medium text-[#1d3d68]">
              <span>Nom</span>
              <input
                name="name"
                className="w-full rounded-xl border border-[#d9d4cf] px-4 py-3 outline-none focus:border-[#1d3d68]"
                placeholder="AppThera Qualité"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium text-[#1d3d68]">
              <span>Slug</span>
              <input
                name="slug"
                className="w-full rounded-xl border border-[#d9d4cf] px-4 py-3 outline-none focus:border-[#1d3d68]"
                placeholder="appthera-qualite"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[#1d3d68] px-6 text-sm font-semibold text-white transition hover:bg-[#142846] cursor-pointer"
            >
              Créer
            </button>
          </form>

          <section className="rounded-xl border border-[#d9d4cf] bg-white p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[#1d3d68]">
                Mes organisations
              </h2>
              <p className="text-sm text-[#4b6484]">
                Sélectionne celle qui doit être active.
              </p>
            </div>
            <div className="space-y-3">
              {organizations.length > 0 ? (
                organizations.map((org) => (
                  <div
                    key={org.organizationId}
                    className={`rounded-lg border p-4 ${activeOrganizationId === org.organizationId ? "border-[#1d3d68] bg-[#eef3ff]" : "border-[#e4dfda] bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[#1d3d68]">
                          {org.name}
                        </p>
                        <p className="text-sm text-[#4b6484]">{org.slug}</p>
                        <p className="text-xs text-[#4b6484]">
                          Ton rôle : {org.memberRole}
                        </p>
                      </div>
                      <form action={setActiveOrganizationAction}>
                        <input
                          type="hidden"
                          name="organizationId"
                          value={org.organizationId}
                        />
                        <button
                          type="submit"
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-[#1d3d68] bg-white px-4 text-sm font-semibold text-[#1d3d68] transition hover:bg-[#1d3d68] hover:text-white cursor-pointer"
                        >
                          Activer
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-[#d9d4cf] p-4 text-sm text-[#4b6484]">
                  Aucune organisation pour le moment.
                </p>
              )}
            </div>
          </section>
        </section>

        {activeOrganizationId &&
        ["owner", "admin"].includes(organizationSession.user.role || "") ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <form
              action={sendInvitationAction}
              className="rounded-xl border border-[#d9d4cf] bg-white p-5 space-y-4"
            >
              <h2 className="text-lg font-semibold text-[#1d3d68]">
                Inviter quelqu’un
              </h2>
              <input
                type="hidden"
                name="organizationId"
                value={activeOrganizationId}
              />
              <label className="block space-y-2 text-sm font-medium text-[#1d3d68]">
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  className="w-full rounded-xl border border-[#d9d4cf] px-4 py-3 outline-none focus:border-[#1d3d68]"
                  placeholder="prenom.nom@entreprise.com"
                />
              </label>
              <label className="block space-y-2 text-sm font-medium text-[#1d3d68]">
                <span>Rôle</span>
                <select
                  name="role"
                  className="w-full rounded-xl border border-[#d9d4cf] px-4 py-3 outline-none focus:border-[#1d3d68]"
                >
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                  <option value="owner">owner</option>
                </select>
              </label>
              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[#ea553a] px-6 text-sm font-semibold text-white transition hover:bg-[#d84b31] cursor-pointer"
              >
                Envoyer l’invitation
              </button>
            </form>

            <div className="rounded-xl border border-[#d9d4cf] bg-white p-5 space-y-4">
              <h2 className="text-lg font-semibold text-[#1d3d68]">
                Membres et invitations
              </h2>
              <div>
                <h3 className="text-sm font-semibold text-[#1d3d68]">
                  Membres
                </h3>
                <ul className="mt-2 space-y-2 text-sm text-[#4b6484]">
                  {members.map((memberItem) => (
                    <li
                      key={memberItem.id}
                      className="rounded-lg border border-[#e4dfda] px-4 py-3"
                    >
                      <p className="font-semibold text-[#1d3d68]">
                        {memberItem.userName}
                      </p>
                      <p>{memberItem.userEmail}</p>
                      <p>Rôle : {memberItem.role}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#1d3d68]">
                  Invitations envoyées
                </h3>
                <ul className="mt-2 space-y-2 text-sm text-[#4b6484]">
                  {invitations.map((inv) => (
                    <li
                      key={inv.id}
                      className="rounded-lg border border-[#e4dfda] px-4 py-3"
                    >
                      <p className="font-semibold text-[#1d3d68]">
                        {inv.email}
                      </p>
                      <p>Rôle : {inv.role}</p>
                      <p>Status : {inv.status}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-xl border border-[#d9d4cf] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#1d3d68]">Actions</h2>
          <form
            action={leaveOrganizationAction}
            className="mt-4 flex flex-wrap items-center gap-3"
          >
            <input
              type="hidden"
              name="organizationId"
              value={activeOrganizationId ?? ""}
            />
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#e5533b] bg-white px-5 text-sm font-semibold text-[#e5533b] transition hover:bg-[#fff1ef] cursor-pointer"
              disabled={!activeOrganizationId}
            >
              Quitter l’organisation active
            </button>
            <a
              href="/quiz"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#1d3d68] px-5 text-sm font-semibold text-white transition hover:bg-[#142846]"
            >
              Aller aux quizzes
            </a>
            <SignOutButton />
          </form>
        </section>
      </main>
    </div>
  );
}
