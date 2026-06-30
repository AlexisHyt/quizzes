import { UserApiKeyCard } from "@/app/quiz/user-api-key-card";

export default async function Page() {
  return (
    <div className="flex min-h-screen items-start justify-center bg-[#e7e0d8] px-6 py-10 text-[#1f3e68]">
      <main className="w-full max-w-6xl space-y-8 rounded-2xl border border-[#e4dfda] bg-[#f6f6f6] p-8 shadow-[0_16px_40px_rgba(22,26,29,0.12)] sm:p-10">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] text-[#e5533b] uppercase">
            Mon compte
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#1d3d68]">
            Gérer mon compte
          </h1>
        </div>

        <UserApiKeyCard />
      </main>
    </div>
  );
}
