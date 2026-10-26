-- Plan 0248 gives a Casting Round one subject: a Look (casting candidates) or
-- a costume (character sheets). Drizzle Kit generated the casting_round
-- rebuild; two documented custom edits keep it correct:
-- 1. The generated copy selected the new `cast_costume_id` column from the old
--    table, which does not have it. Existing rounds are Look rounds, so the
--    copy writes NULL there.
-- 2. Drizzle runs SQLite migrations inside a transaction, so the generated
--    `PRAGMA foreign_keys=OFF` has no effect and dropping `casting_round` would
--    fail on the `casting_candidate` rows that reference it. The candidates are
--    copied aside before the rebuild and restored afterwards, unchanged.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__preserved_casting_candidate` AS
SELECT `asset_file_id`, `casting_round_id`, `status`, `model_key`
FROM `casting_candidate`;--> statement-breakpoint
DELETE FROM `casting_candidate`;--> statement-breakpoint
CREATE TABLE `__new_casting_round` (
	`id` text PRIMARY KEY NOT NULL,
	`cast_look_id` text,
	`cast_costume_id` text,
	`number` integer NOT NULL,
	`routes_json` text NOT NULL,
	`max_concurrent_generations` integer NOT NULL,
	`reference_asset_file_ids_json` text NOT NULL,
	`estimated_cost_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cast_look_id`) REFERENCES `cast_look`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cast_costume_id`) REFERENCES `cast_costume`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "casting_round_one_subject_check" CHECK(("__new_casting_round"."cast_look_id" is null) <> ("__new_casting_round"."cast_costume_id" is null))
);
--> statement-breakpoint
INSERT INTO `__new_casting_round`("id", "cast_look_id", "cast_costume_id", "number", "routes_json", "max_concurrent_generations", "reference_asset_file_ids_json", "estimated_cost_json", "created_at") SELECT "id", "cast_look_id", NULL, "number", "routes_json", "max_concurrent_generations", "reference_asset_file_ids_json", "estimated_cost_json", "created_at" FROM `casting_round`;--> statement-breakpoint
DROP TABLE `casting_round`;--> statement-breakpoint
ALTER TABLE `__new_casting_round` RENAME TO `casting_round`;--> statement-breakpoint
INSERT INTO `casting_candidate` (`asset_file_id`, `casting_round_id`, `status`, `model_key`)
SELECT `asset_file_id`, `casting_round_id`, `status`, `model_key`
FROM `__preserved_casting_candidate`;--> statement-breakpoint
DROP TABLE `__preserved_casting_candidate`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `casting_round_look_number_idx` ON `casting_round` (`cast_look_id`,`number`) WHERE "casting_round"."cast_look_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `casting_round_costume_number_idx` ON `casting_round` (`cast_costume_id`,`number`) WHERE "casting_round"."cast_costume_id" is not null;