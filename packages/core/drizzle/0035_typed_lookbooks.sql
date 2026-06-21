CREATE TABLE `lookbook_selection` (
	`lookbook_type` text PRIMARY KEY NOT NULL,
	`lookbook_id` text NOT NULL,
	`selected_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`lookbook_id`) REFERENCES `lookbook`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lookbook_selection_lookbook_idx` ON `lookbook_selection` (`lookbook_id`);--> statement-breakpoint
CREATE TABLE `storyboard_lookbook_source_movie` (
	`storyboard_lookbook_id` text NOT NULL,
	`movie_lookbook_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	PRIMARY KEY(`storyboard_lookbook_id`, `movie_lookbook_id`),
	FOREIGN KEY (`storyboard_lookbook_id`) REFERENCES `lookbook`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`movie_lookbook_id`) REFERENCES `lookbook`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `storyboard_lookbook_source_movie_order_idx` ON `storyboard_lookbook_source_movie` (`storyboard_lookbook_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `storyboard_lookbook_source_movie_movie_idx` ON `storyboard_lookbook_source_movie` (`movie_lookbook_id`);--> statement-breakpoint
ALTER TABLE `lookbook` ADD `type` text NOT NULL DEFAULT 'movie';--> statement-breakpoint
ALTER TABLE `lookbook` ADD `definition_json` text NOT NULL DEFAULT '{}';--> statement-breakpoint
UPDATE `lookbook`
SET
	`type` = 'movie',
	`definition_json` =
		'{"thesis":' || `thesis` ||
		',"palette":' || `palette` ||
		',"toneMood":' || `tone_mood` ||
		',"composition":' || `composition` ||
		',"lighting":' || `lighting` ||
		',"texture":' || `texture` ||
		',"camera":' || `camera` ||
		'}';--> statement-breakpoint
UPDATE `lookbook_image_section`
SET `section` = 'toneMood'
WHERE `section` = 'tone_mood';--> statement-breakpoint
UPDATE `media_generation_spec`
SET `spec_json` = replace(`spec_json`, '"tone_mood"', '"toneMood"')
WHERE `purpose` = 'lookbook.image'
	AND `spec_json` LIKE '%"tone_mood"%';--> statement-breakpoint
UPDATE `media_generation_run`
SET `spec_snapshot_json` = replace(`spec_snapshot_json`, '"tone_mood"', '"toneMood"')
WHERE `purpose` = 'lookbook.image'
	AND `spec_snapshot_json` LIKE '%"tone_mood"%';--> statement-breakpoint
INSERT INTO `lookbook_selection` (`lookbook_type`, `lookbook_id`, `selected_at`, `updated_at`)
SELECT 'movie', `active_lookbook_id`, `updated_at`, `updated_at`
FROM `visual_language_state`
WHERE `active_lookbook_id` IS NOT NULL;--> statement-breakpoint
DROP TABLE `visual_language_state`;--> statement-breakpoint
ALTER TABLE `lookbook` DROP COLUMN `thesis`;--> statement-breakpoint
ALTER TABLE `lookbook` DROP COLUMN `palette`;--> statement-breakpoint
ALTER TABLE `lookbook` DROP COLUMN `tone_mood`;--> statement-breakpoint
ALTER TABLE `lookbook` DROP COLUMN `composition`;--> statement-breakpoint
ALTER TABLE `lookbook` DROP COLUMN `lighting`;--> statement-breakpoint
ALTER TABLE `lookbook` DROP COLUMN `texture`;--> statement-breakpoint
ALTER TABLE `lookbook` DROP COLUMN `camera`;--> statement-breakpoint
PRAGMA user_version = 26;
