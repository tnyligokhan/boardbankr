CREATE TABLE "game_players" (
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"seat" integer NOT NULL,
	"color" text NOT NULL,
	"balance" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"out_at" timestamp with time zone,
	CONSTRAINT "game_players_game_id_user_id_pk" PRIMARY KEY("game_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'lobby' NOT NULL,
	"host_user_id" uuid NOT NULL,
	"starting_capital" integer NOT NULL,
	"salary" integer NOT NULL,
	"currency" text NOT NULL,
	"free_parking_enabled" boolean NOT NULL,
	"free_parking_pot" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"winner_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL,
	"client_tx_id" text,
	"kind" text NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"from_user_id" uuid,
	"to_user_id" uuid,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"google_sub" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_winner_user_id_users_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_players_user_idx" ON "game_players" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "games_open_code_idx" ON "games" USING btree ("code") WHERE status <> 'finished';--> statement-breakpoint
CREATE INDEX "games_code_idx" ON "games" USING btree ("code");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_client_tx_idx" ON "transactions" USING btree ("game_id","client_tx_id");--> statement-breakpoint
CREATE INDEX "transactions_game_idx" ON "transactions" USING btree ("game_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_sub_idx" ON "users" USING btree ("google_sub");