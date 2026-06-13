import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  json,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
    activeOrganizationId: text("active_organization_id"),
    activeTeamId: text("active_team_id"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", {
    precision: 6,
    withTimezone: true,
  }).notNull(),
});

export const member = pgTable("member", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdAt: timestamp("created_at", {
    precision: 6,
    withTimezone: true,
  }).notNull(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  role: text("role"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", {
    precision: 6,
    withTimezone: true,
  }).notNull(),
  expiresAt: timestamp("expires_at", {
    precision: 6,
    withTimezone: true,
  }).notNull(),
});

export const organizationRole = pgTable("organization_role", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  permission: text("permission").notNull(),
  createdAt: timestamp("created_at", {
    precision: 6,
    withTimezone: true,
  }).notNull(),
  updatedAt: timestamp("updated_at", { precision: 6, withTimezone: true }),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

/**
 * Quizzes tables
 */
export const quizzes = pgTable(
  "quizzes",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    weekNumber: varchar("weekNumber", { length: 10 }).notNull(), // S01, S02, etc.
    date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD format
    label: text("label").notNull(), // Human readable date
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("quizzes_organizationId_idx").on(table.organizationId),
    uniqueIndex("quizzes_organization_week_unique").on(
      table.organizationId,
      table.weekNumber,
    ),
  ],
);

export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = typeof quizzes.$inferInsert;

export const questions = pgTable("questions", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  quizId: integer("quizId")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  questionText: text("questionText").notNull(),
  options: json("options").$type<string[]>().notNull(), // Array of answer options
  correctAnswer: integer("correctAnswer").notNull(), // Index of correct option (0-3)
  explanation: text("explanation").notNull(),
  orderIndex: integer("orderIndex").notNull(), // Question order within quiz (1, 2, 3)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = typeof questions.$inferInsert;

export const userResponses = pgTable("userResponses", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  attemptId: integer("attemptId")
    .notNull()
    .references(() => quizAttempts.id, { onDelete: "cascade" }),
  quizId: integer("quizId")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  questionId: integer("questionId")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  selectedAnswer: integer("selectedAnswer").notNull(), // Index of selected option
  isCorrect: integer("isCorrect").notNull(), // 1 for correct, 0 for incorrect
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserResponse = typeof userResponses.$inferSelect;
export type InsertUserResponse = typeof userResponses.$inferInsert;

export const quizAttempts = pgTable("quizAttempts", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  quizId: integer("quizId")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  score: integer("score").notNull(), // Number of correct answers (0-3)
  totalQuestions: integer("totalQuestions").notNull().default(0),
  pointsEarned: integer("pointsEarned").notNull().default(0),
  medal: text("medal").notNull().default("none"),
  isRevision: integer("isRevision").notNull().default(0), // 1 if revision mode, 0 if actual attempt
  completedAt: timestamp("completedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type InsertQuizAttempt = typeof quizAttempts.$inferInsert;

export const userQuizStats = pgTable(
  "userQuizStats",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    totalPoints: integer("totalPoints").notNull().default(0),
    bestScore: integer("bestScore").notNull().default(0),
    bestTotalQuestions: integer("bestTotalQuestions").notNull().default(0),
    realAttemptsCount: integer("realAttemptsCount").notNull().default(0),
    revisionAttemptsCount: integer("revisionAttemptsCount")
      .notNull()
      .default(0),
    lastRealAttemptAt: timestamp("lastRealAttemptAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_quiz_stats_user_org_unique").on(
      table.userId,
      table.organizationId,
    ),
    index("user_quiz_stats_organization_idx").on(table.organizationId),
  ],
);

export type UserQuizStats = typeof userQuizStats.$inferSelect;
export type InsertUserQuizStats = typeof userQuizStats.$inferInsert;
