-- Intentional destructive cleanup for the movie-only screenplay model. Studio
-- is pre-customer, and generation 3 does not preserve obsolete imported
-- screenplay/setup rows.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TABLE `block_cast_member`;--> statement-breakpoint
DROP TABLE `block_location`;--> statement-breakpoint
DROP TABLE `block`;--> statement-breakpoint
DELETE FROM `cast_asset`;--> statement-breakpoint
DELETE FROM `location_asset`;--> statement-breakpoint
DELETE FROM `sequence_asset`;--> statement-breakpoint
DELETE FROM `scene_asset`;--> statement-breakpoint
DELETE FROM `scene_location`;--> statement-breakpoint
DELETE FROM `scene`;--> statement-breakpoint
DELETE FROM `sequence`;--> statement-breakpoint
DELETE FROM `act`;--> statement-breakpoint
DELETE FROM `cast_member`;--> statement-breakpoint
DELETE FROM `location`;--> statement-breakpoint
DELETE FROM `screenplay`;--> statement-breakpoint
ALTER TABLE `cast_member` ADD `handle` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `cast_member_handle_idx` ON `cast_member` (`handle`);--> statement-breakpoint
ALTER TABLE `location` ADD `handle` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `location_handle_idx` ON `location` (`handle`);--> statement-breakpoint
ALTER TABLE `project` ADD `summary` text;--> statement-breakpoint
ALTER TABLE `scene` ADD `blocks_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
PRAGMA user_version = 3;--> statement-breakpoint
PRAGMA foreign_keys=ON;
