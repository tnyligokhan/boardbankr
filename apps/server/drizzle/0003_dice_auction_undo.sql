ALTER TABLE "games" ADD COLUMN "last_roll" jsonb;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "auction" jsonb;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reverses_tx_id" bigint;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "note" text;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_reverses_idx" ON "transactions" USING btree ("game_id","reverses_tx_id");