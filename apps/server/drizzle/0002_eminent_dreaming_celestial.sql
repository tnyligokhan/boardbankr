CREATE TABLE "game_rounds" (
	"game_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"balances" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_rounds_game_id_round_pk" PRIMARY KEY("game_id","round")
);
--> statement-breakpoint
ALTER TABLE "game_players" ADD COLUMN "token" text DEFAULT 'rocket' NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "turns_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "round" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "turn_user_id" uuid;--> statement-breakpoint
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Games that started before turns existed have no turn data, so they keep playing without them.
UPDATE "games" SET "turns_enabled" = false WHERE "status" <> 'lobby';
