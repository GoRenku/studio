DROP TABLE `scene_shot_video_take_media_input_shot`;--> statement-breakpoint
DROP TABLE `scene_shot_video_take_media_input`;--> statement-breakpoint
-- Drizzle Kit generated the parent-table rebuild below for the version-3
-- state default. Drizzle applies SQLite migrations inside a transaction, where
-- PRAGMA foreign_keys=OFF cannot take effect. Preserve and restore both current
-- child tables explicitly so dropping the old parent cannot cascade away Shot
-- membership or final-video records.
CREATE TEMP TABLE `__preserved_scene_shot_video_take_shot` AS
SELECT * FROM `scene_shot_video_take_shot`;--> statement-breakpoint
CREATE TEMP TABLE `__preserved_scene_shot_video_take_video` AS
SELECT * FROM `scene_shot_video_take_video`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_scene_shot_video_take` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`source_shot_list_id` text NOT NULL,
	`title` text NOT NULL,
	`state_json` text DEFAULT '{"version":3,"structure":{"mode":"continuous","sharedDirection":{}}}' NOT NULL,
	`is_picked` integer DEFAULT false NOT NULL,
	`regenerated_from_take_id` text,
	`media_folder_project_relative_path` text,
	`history_snapshot_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_shot_list_id`) REFERENCES `scene_shot_list`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`regenerated_from_take_id`) REFERENCES `scene_shot_video_take`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_scene_shot_video_take`("id", "scene_id", "source_shot_list_id", "title", "state_json", "is_picked", "regenerated_from_take_id", "media_folder_project_relative_path", "history_snapshot_json", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at") SELECT "id", "scene_id", "source_shot_list_id", "title", "state_json", "is_picked", "regenerated_from_take_id", "media_folder_project_relative_path", "history_snapshot_json", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at" FROM `scene_shot_video_take`;--> statement-breakpoint
DROP TABLE `scene_shot_video_take`;--> statement-breakpoint
ALTER TABLE `__new_scene_shot_video_take` RENAME TO `scene_shot_video_take`;--> statement-breakpoint
INSERT INTO `scene_shot_video_take_shot` (
	`take_id`, `shot_id`, `shot_order`, `shot_content_fingerprint`,
	`storyboard_image_id`, `storyboard_asset_file_id`,
	`storyboard_content_fingerprint`, `discarded_at`,
	`discard_operation_id`, `restored_at`
)
SELECT
	`take_id`, `shot_id`, `shot_order`, `shot_content_fingerprint`,
	`storyboard_image_id`, `storyboard_asset_file_id`,
	`storyboard_content_fingerprint`, `discarded_at`,
	`discard_operation_id`, `restored_at`
FROM `__preserved_scene_shot_video_take_shot`;--> statement-breakpoint
INSERT INTO `scene_shot_video_take_video` (
	`take_id`, `asset_id`, `asset_file_id`, `created_at`, `updated_at`,
	`discarded_at`, `discard_operation_id`, `restored_at`
)
SELECT
	`take_id`, `asset_id`, `asset_file_id`, `created_at`, `updated_at`,
	`discarded_at`, `discard_operation_id`, `restored_at`
FROM `__preserved_scene_shot_video_take_video`;--> statement-breakpoint
DROP TABLE `__preserved_scene_shot_video_take_shot`;--> statement-breakpoint
DROP TABLE `__preserved_scene_shot_video_take_video`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_scene_idx` ON `scene_shot_video_take` (`scene_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_source_shot_list_idx` ON `scene_shot_video_take` (`source_shot_list_id`,`created_at`,`id`);
