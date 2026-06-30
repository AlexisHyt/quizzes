# Quiz Qualite

Base technique de l'application quiz avec authentication Google (Better Auth + Next.js App Router + Drizzle/PostgreSQL).

## Ce qui est en place

- Login Google uniquement sur `/`
- Endpoint Better Auth sur `/api/auth/[...all]`
- Redirection automatique vers `/quiz` si deja connecte
- Page `/quiz` protegee cote serveur
- Bouton deconnexion
- Gestion de cle API utilisateur (generation, re-generation, affichage masque/visible)
- API publique v1 (x-api-key): liste des organisations et creation de quiz
- Gamification persistée: points, medailles, meilleure performance et historique des tentatives
- Quizzes planifies par periode UTC (`startAt` / `endAt`), avec plusieurs quizzes actifs possibles en meme temps

## Variables d'environnement

Ajoute ces variables dans `.env`:

```dotenv
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
API_KEY_ENCRYPTION_KEY=
```

`API_KEY_ENCRYPTION_KEY` doit etre une cle base64 de 32 bytes (AES-256-GCM).

Exemple de generation:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
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

## API publique (v1)

Authentification via header `x-api-key`.
Acces reserve aux utilisateurs ayant le role `admin` ou `developer` dans au moins une organisation.

- `GET /api/v1/organizations` : liste des organisations liees a l'utilisateur de la cle API (avec IDs)
- `POST /api/v1/quizzes` : creation d'un quiz pour une organisation
- `GET /api/v1/swagger` : spec OpenAPI JSON (publique, sans authentification)
- `GET /api/v1/docs` : interface Swagger UI (publique)

Exemple `POST /api/v1/quizzes`:

```json
{
  "organizationId": "org_xxx",
  "startDate": "2026-07-01",
  "endDate": "2026-07-07",
  "questions": [
	{
	  "questionText": "Question 1",
	  "options": ["A", "B", "C", "D"],
	  "correctAnswer": 1,
	  "explanation": "Explication"
	}
  ]
}
```

