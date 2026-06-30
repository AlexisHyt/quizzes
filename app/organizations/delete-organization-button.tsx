"use client";

import { deleteOrganizationAction } from "@/app/organizations/actions";

type DeleteOrganizationButtonProps = {
  organizationId: string;
  organizationName: string;
};

export function DeleteOrganizationButton({
  organizationId,
  organizationName,
}: DeleteOrganizationButtonProps) {
  return (
    <form
      action={deleteOrganizationAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Êtes-vous sûr de vouloir supprimer l’organisation « ${organizationName} » ? ` +
            "Cette action est irréversible et supprimera définitivement tous les quizzes, " +
            "questions, réponses et statistiques associés.",
        );
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center rounded-xl bg-[#e5533b] px-5 text-sm font-semibold text-white transition hover:bg-[#cf452f] cursor-pointer"
      >
        Supprimer l’organisation
      </button>
    </form>
  );
}

