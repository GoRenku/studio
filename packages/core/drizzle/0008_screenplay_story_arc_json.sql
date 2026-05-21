ALTER TABLE `screenplay` ADD `story_arc` text;--> statement-breakpoint
ALTER TABLE `screenplay` DROP COLUMN `structure_model`;--> statement-breakpoint
ALTER TABLE `act` DROP COLUMN `key_beats`;--> statement-breakpoint
PRAGMA user_version = 5;
