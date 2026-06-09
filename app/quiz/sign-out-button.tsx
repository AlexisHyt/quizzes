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
      className="inline-flex h-12 items-center justify-center rounded-xl bg-red-500 px-7 text-base font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
    >
      {isLoading ? "Deconnexion..." : "Se déconnecter"}
    </button>
  );
}
