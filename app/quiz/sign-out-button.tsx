"use client";

import { useState } from "react";
import { authClient } from "@/auth-client";

export function SignOutButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await authClient.signOut();
      window.location.href = "/";
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isLoading}
      className="inline-flex h-12 items-center justify-center rounded-xl border border-[#d9d4cf] bg-[#efeeec] px-7 text-base font-semibold text-[#1d3d68] transition hover:bg-[#e8e5e1] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isLoading ? "Deconnexion..." : "Se deconnecter"}
    </button>
  );
}
