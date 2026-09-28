CREATE TYPE "public"."multiplayer_mode" AS ENUM('official', 'platform', 'custom');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('starting', 'running', 'stopped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."version_status" AS ENUM('downloading', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"version" text NOT NULL,
	"container_id" text,
	"status" "session_status" DEFAULT 'starting' NOT NULL,
	"vnc_password" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stopped_at" timestamp with time zone,
	"stop_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_versions" (
	"tag" text PRIMARY KEY NOT NULL,
	"release_url" text NOT NULL,
	"published_at" timestamp with time zone,
	"game_jar_sha256" text,
	"server_jar_sha256" text,
	"status" "version_status" DEFAULT 'downloading' NOT NULL,
	"error" text,
	"is_current" boolean DEFAULT false NOT NULL,
	"downloaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"locale" text DEFAULT 'fr' NOT NULL,
	"unciv_user_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"multiplayer_mode" "multiplayer_mode" DEFAULT 'official' NOT NULL,
	"custom_multiplayer_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_version_game_versions_tag_fk" FOREIGN KEY ("version") REFERENCES "public"."game_versions"("tag") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_sessions_status_idx" ON "game_sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "game_sessions_one_active_per_user" ON "game_sessions" USING btree ("user_id") WHERE "game_sessions"."status" in ('starting', 'running');--> statement-breakpoint
CREATE UNIQUE INDEX "game_versions_single_current" ON "game_versions" USING btree ("is_current") WHERE "game_versions"."is_current" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree (lower("username"));