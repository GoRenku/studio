CREATE TABLE `screenplay_analysis` (
	`id` text PRIMARY KEY NOT NULL,
	`structure_model` text NOT NULL,
	`document` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `screenplay_analysis_updated_at_id_idx` ON `screenplay_analysis` (`updated_at`,`id`);--> statement-breakpoint
CREATE TABLE `screenplay_analysis_state` (
	`id` text PRIMARY KEY NOT NULL,
	`active_analysis_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`active_analysis_id`) REFERENCES `screenplay_analysis`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `screenplay` DROP COLUMN `story_arc`;--> statement-breakpoint
PRAGMA user_version = 8;
