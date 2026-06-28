ALTER TABLE "quizzes" ADD COLUMN "startAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "endAt" timestamp with time zone;--> statement-breakpoint

UPDATE "quizzes"
SET
  "startAt" = ("date" || 'T00:00:00.000Z')::timestamp with time zone,
  "endAt" = (
    to_char(("date"::date + interval '6 day')::date, 'YYYY-MM-DD') ||
    'T23:59:59.999Z'
  )::timestamp with time zone;--> statement-breakpoint

ALTER TABLE "quizzes" ALTER COLUMN "startAt" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ALTER COLUMN "endAt" SET NOT NULL;--> statement-breakpoint

DROP INDEX IF EXISTS "quizzes_organization_week_unique";--> statement-breakpoint
ALTER TABLE "quizzes" DROP COLUMN "weekNumber";--> statement-breakpoint
ALTER TABLE "quizzes" DROP COLUMN "date";--> statement-breakpoint
ALTER TABLE "quizzes" DROP COLUMN "label";--> statement-breakpoint

CREATE INDEX "quizzes_organization_startAt_idx" ON "quizzes" USING btree ("organization_id","startAt");--> statement-breakpoint
CREATE INDEX "quizzes_organization_endAt_idx" ON "quizzes" USING btree ("organization_id","endAt");

