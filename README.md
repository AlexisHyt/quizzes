# Quiz Qualite

Base technique de l'application quiz avec authentication Google (Better Auth + Next.js App Router + Drizzle/PostgreSQL).

## Ce qui est en place

- Login Google uniquement sur `/`
- Endpoint Better Auth sur `/api/auth/[...all]`
- Redirection automatique vers `/quiz` si deja connecte
- Page `/quiz` protegee cote serveur
- Bouton deconnexion
- Gamification persistée: points, medailles, meilleure performance et historique des tentatives

## Variables d'environnement

Ajoute ces variables dans `.env`:

```dotenv
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## Lancer le projet

```bash
npm install
npx drizzle-kit migrate
npm run dev
```

Ouvre ensuite `http://localhost:3000`.

## Verification rapide

```bash
npm run build
```
