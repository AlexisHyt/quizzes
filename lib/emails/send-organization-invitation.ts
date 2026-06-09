import { baseEmail, resend } from "@/lib/emails/resend.config";

type SendOrganizationInvitationEmailArgs = {
  id: string;
  email: string;
  role: string;
  organization: {
    name: string;
    slug: string;
  };
  request?: Request;
};

function getAppOrigin(request?: Request): string {
  if (request) {
    return new URL(request.url).origin;
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "";
}

export async function sendOrganizationInvitationEmail({
  id,
  email,
  role,
  organization,
  request,
}: SendOrganizationInvitationEmailArgs) {
  const origin = getAppOrigin(request);
  const acceptUrl = `${origin}/organizations/invitations/${encodeURIComponent(id)}`;

  await resend.emails.send({
    from: baseEmail,
    to: email,
    subject: `Invitation à rejoindre ${organization.name}`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; line-height: 1.5; color: #1d3d68;">
        <h1 style="font-size: 24px; margin-bottom: 16px;">Invitation à rejoindre ${organization.name}</h1>
        <p>Tu as été invité·e en tant que <strong>${role}</strong> dans l’organisation <strong>${organization.name}</strong>.</p>
        <p style="margin: 24px 0;">
          <a href="${acceptUrl}" style="display: inline-block; background: #ea553a; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 600;">
            Accepter l’invitation
          </a>
        </p>
        <p>Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :</p>
        <p><a href="${acceptUrl}">${acceptUrl}</a></p>
        <p style="margin-top: 24px; color: #4b6484;">Organisation : ${organization.name} (${organization.slug})</p>
      </div>
    `,
    text: `Invitation à rejoindre ${organization.name}\n\nRôle: ${role}\nLien: ${acceptUrl}`,
  });
}
