import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { acceptInvitationAction } from "@/app/organizations/actions";
import { auth } from "@/auth";
import { db } from "@/drizzle/db";
import { invitation } from "@/drizzle/schema";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/");
  }

  const { id } = await params;
  const [currentInvitation] = await db
    .select()
    .from(invitation)
    .where(eq(invitation.id, id))
    .limit(1);

  if (!currentInvitation) {
    notFound();
  }

  const isRecipient =
    currentInvitation.email.toLowerCase() === session.user.email.toLowerCase();

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#e7e0d8] px-6 py-16 text-[#1f3e68]">
      <main className="w-full max-w-2xl rounded-2xl border border-[#e4dfda] bg-[#f6f6f6] p-8 shadow-[0_16px_40px_rgba(22,26,29,0.12)] sm:p-10">
        <p className="text-xs font-semibold tracking-[0.22em] text-[#e5533b] uppercase">
          Invitation
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#1d3d68]">
          Rejoindre l’organisation
        </h1>
        <p className="mt-4 text-lg leading-8 text-[#4b6484]">
          {isRecipient
            ? `Tu as été invité·e à rejoindre cette organisation avec le rôle ${currentInvitation.role}.`
            : "Cette invitation ne correspond pas à ton adresse e-mail connectée."}
        </p>

        <div className="mt-8 rounded-xl border border-[#d9d4cf] bg-white p-5">
          <p className="text-sm font-semibold text-[#1d3d68]">Invite ID</p>
          <p className="mt-1 text-sm text-[#4b6484]">{currentInvitation.id}</p>
          <p className="mt-4 text-sm font-semibold text-[#1d3d68]">Statut</p>
          <p className="mt-1 text-sm text-[#4b6484]">
            {currentInvitation.status}
          </p>
        </div>

        <form action={acceptInvitationAction} className="mt-8">
          <input
            type="hidden"
            name="invitationId"
            value={currentInvitation.id}
          />
          <button
            type="submit"
            disabled={!isRecipient}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-[#ea553a] px-7 text-base font-semibold text-white transition hover:bg-[#d84b31] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            Accepter l’invitation
          </button>
        </form>

        <div className="mt-6">
          <a
            href="/organizations"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[#d9d4cf] bg-white px-5 text-sm font-semibold text-[#1d3d68] transition hover:bg-[#e7e0d8]"
          >
            Retour aux organisations
          </a>
        </div>
      </main>
    </div>
  );
}
