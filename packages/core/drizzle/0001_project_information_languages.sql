ALTER TABLE `project_language` ADD `supports_audio` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `project_language` ADD `supports_subtitles` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `project` DROP COLUMN `format`;--> statement-breakpoint
ALTER TABLE `project` DROP COLUMN `base_language`;--> statement-breakpoint
ALTER TABLE `project` DROP COLUMN `resolution_width`;--> statement-breakpoint
ALTER TABLE `project` DROP COLUMN `resolution_height`;