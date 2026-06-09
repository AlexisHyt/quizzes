"use client";

import { useState } from "react";
import { authClient } from "@/auth-client";

export function LoginCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/organizations",
      });
    } catch {
      setErrorMessage("Impossible de lancer la connexion Google. Reessaie.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#e7e0d8] px-6 py-16 text-[#1f3e68]">
      <main className="w-full max-w-3xl rounded-2xl border border-[#e4dfda] bg-[#f6f6f6] p-8 shadow-[0_16px_40px_rgba(22,26,29,0.12)] sm:p-10">
        <p className="text-xs font-semibold tracking-[0.22em] text-[#e5533b] uppercase">
          Quizz qualite - les 3 questions du lundi
        </p>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#1d3d68]">
          Le quizz de la semaine
        </h1>

        <p className="mt-4 inline-flex rounded-full border border-[#d9d4cf] bg-[#efeeec] px-4 py-1 text-sm font-semibold text-[#1d3d68]">
          S01 - Lundi 8 juin 2026
        </p>

        <p className="mt-4 max-w-2xl text-lg leading-8 text-[#4b6484]">
          3 questions sur notre QMS, ~2 minutes. Connecte-toi avec Google pour
          demarrer et enregistrer tes reponses automatiquement.
        </p>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-[#ea553a] px-7 text-base font-semibold text-white transition hover:bg-[#d84b31] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Connexion..." : "Continuer avec Google"}
        </button>

        {errorMessage ? (
          <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
        ) : null}

        <div className="mt-8 border-t border-[#dad5d0] pt-5 text-sm text-[#5a7392]">
          AppThera - QMS Formation 2026-2027
        </div>
      </main>
    </div>
  );
}
