CREATE TABLE `screenplay_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`screenplay_document` text NOT NULL,
	`source_command` text NOT NULL,
	`summary` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `screenplay_revision_created_idx` ON `screenplay_revision` (`created_at`,`id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `scene_shot_storyboard_image` RENAME TO `__old_scene_shot_storyboard_image`;--> statement-breakpoint
ALTER TABLE `scene_shot_storyboard_sheet` RENAME TO `__old_scene_shot_storyboard_sheet`;--> statement-breakpoint
CREATE TABLE `scene_shot_storyboard_image` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`shot_list_id` text NOT NULL,
	`shot_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`asset_file_id` text NOT NULL,
	`source_purpose` text NOT NULL,
	`shot_content_fingerprint` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shot_list_id`) REFERENCES `scene_shot_list`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `scene_shot_storyboard_image` (
	`id`,
	`scene_id`,
	`shot_list_id`,
	`shot_id`,
	`asset_id`,
	`asset_file_id`,
	`source_purpose`,
	`shot_content_fingerprint`,
	`created_at`,
	`updated_at`
)
SELECT
	old_image.`id`,
	shot_list.`scene_id`,
	old_sheet.`shot_list_id`,
	old_image.`shot_id`,
	old_sheet.`asset_id`,
	old_image.`asset_file_id`,
	'scene.storyboard-sheet',
	'legacy:' || old_image.`asset_file_id`,
	old_image.`created_at`,
	old_image.`updated_at`
FROM `__old_scene_shot_storyboard_image` old_image
INNER JOIN `__old_scene_shot_storyboard_sheet` old_sheet
	ON old_sheet.`id` = old_image.`storyboard_sheet_id`
INNER JOIN `scene_shot_list` shot_list
	ON shot_list.`id` = old_sheet.`shot_list_id`;--> statement-breakpoint
DROP TABLE `__old_scene_shot_storyboard_image`;--> statement-breakpoint
DROP TABLE `__old_scene_shot_storyboard_sheet`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `scene_shot_storyboard_image_scene_idx` ON `scene_shot_storyboard_image` (`scene_id`);--> statement-breakpoint
CREATE INDEX `scene_shot_storyboard_image_shot_list_idx` ON `scene_shot_storyboard_image` (`shot_list_id`,`shot_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `scene_shot_storyboard_image_asset_idx` ON `scene_shot_storyboard_image` (`asset_id`);--> statement-breakpoint
PRAGMA user_version = 14;
