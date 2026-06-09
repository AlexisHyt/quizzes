ALTER TABLE "quizzes" DROP CONSTRAINT "quizzes_weekNumber_unique";--> statement-breakpoint
INSERT INTO "organization" ("id", "name", "slug", "logo", "metadata", "created_at")
VALUES ('org_default', 'Organisation par defaut', 'default', NULL, NULL, NOW())
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
UPDATE "quizzes"
SET "organization_id" = 'org_default'
WHERE "organization_id" IS NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_quizId_quizzes_id_fk" FOREIGN KEY ("quizId") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizAttempts" ADD CONSTRAINT "quizAttempts_quizId_quizzes_id_fk" FOREIGN KEY ("quizId") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userResponses" ADD CONSTRAINT "userResponses_quizId_quizzes_id_fk" FOREIGN KEY ("quizId") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userResponses" ADD CONSTRAINT "userResponses_questionId_questions_id_fk" FOREIGN KEY ("questionId") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quizzes_organizationId_idx" ON "quizzes" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quizzes_organization_week_unique" ON "quizzes" USING btree ("organization_id","weekNumber");