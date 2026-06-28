import { SignOutButton } from "@/app/quiz/sign-out-button";

type TopNavbarProps = {
  user: {
    name: string;
    email: string;
  };
  activeOrganizationName: string | null;
  canAccessAdmin: boolean;
};

export function TopNavbar({
  user,
  activeOrganizationName,
  canAccessAdmin,
}: TopNavbarProps) {
  return (
    <header className="w-full border-b border-[#d9d4cf] bg-[#f6f6f6] text-[#1d3d68]">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-[#4b6484]">{user.email}</p>
          {activeOrganizationName ? (
            <p className="mt-1 truncate text-xs font-semibold text-[#e5533b]">
              Organisation active : {activeOrganizationName}
            </p>
          ) : null}
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          <a
            href="/quiz"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d9d4cf] bg-white px-4 text-sm font-semibold text-[#1d3d68] transition hover:bg-[#e7e0d8]"
          >
            Quiz
          </a>
          <a
            href="/organizations"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d9d4cf] bg-white px-4 text-sm font-semibold text-[#1d3d68] transition hover:bg-[#e7e0d8]"
          >
            Organisations
          </a>
          {canAccessAdmin ? (
            <a
              href="/admin"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-[#1d3d68] px-4 text-sm font-semibold text-white transition hover:bg-[#1a2d52]"
            >
              Admin
            </a>
          ) : null}
          <SignOutButton className="h-10 px-4 text-sm" />
        </nav>
      </div>
    </header>
  );
}

