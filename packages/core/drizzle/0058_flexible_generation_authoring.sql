CREATE TABLE `scene_shot_reference_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`shot_list_id` text NOT NULL,
	`shot_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`asset_file_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shot_list_id`) REFERENCES `scene_shot_list`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_reference_asset_slot_idx` ON `scene_shot_reference_asset` (`shot_list_id`,`shot_id`,`asset_file_id`);--> statement-breakpoint
CREATE INDEX `scene_shot_reference_asset_scene_idx` ON `scene_shot_reference_asset` (`scene_id`);--> statement-breakpoint
CREATE INDEX `scene_shot_reference_asset_shot_idx` ON `scene_shot_reference_asset` (`shot_list_id`,`shot_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `scene_shot_reference_asset_asset_idx` ON `scene_shot_reference_asset` (`asset_id`);--> statement-breakpoint
CREATE TABLE `_migration_0058_take_shot` AS SELECT * FROM `scene_shot_video_take_shot`;--> statement-breakpoint
CREATE TABLE `_migration_0058_take_image` AS SELECT * FROM `scene_shot_video_take_image`;--> statement-breakpoint
CREATE TABLE `_migration_0058_take_video` AS SELECT * FROM `scene_shot_video_take_video`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_scene_shot_video_take` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`source_shot_list_id` text NOT NULL,
	`title` text NOT NULL,
	`state_json` text DEFAULT '{"version":3,"structure":{"mode":"continuous","sharedDirection":{}}}' NOT NULL,
	`is_picked` integer DEFAULT false NOT NULL,
	`media_folder_project_relative_path` text,
	`history_snapshot_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_shot_list_id`) REFERENCES `scene_shot_list`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_scene_shot_video_take`("id", "scene_id", "source_shot_list_id", "title", "state_json", "is_picked", "media_folder_project_relative_path", "history_snapshot_json", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at") SELECT "id", "scene_id", "source_shot_list_id", "title", "state_json", "is_picked", "media_folder_project_relative_path", "history_snapshot_json", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at" FROM `scene_shot_video_take`;--> statement-breakpoint
DROP TABLE `scene_shot_video_take`;--> statement-breakpoint
ALTER TABLE `__new_scene_shot_video_take` RENAME TO `scene_shot_video_take`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_scene_idx` ON `scene_shot_video_take` (`scene_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_source_shot_list_idx` ON `scene_shot_video_take` (`source_shot_list_id`,`created_at`,`id`);--> statement-breakpoint
INSERT INTO `scene_shot_video_take_shot` SELECT * FROM `_migration_0058_take_shot`;--> statement-breakpoint
INSERT INTO `scene_shot_video_take_image` SELECT * FROM `_migration_0058_take_image`;--> statement-breakpoint
INSERT INTO `scene_shot_video_take_video` SELECT * FROM `_migration_0058_take_video`;--> statement-breakpoint
DROP TABLE `_migration_0058_take_shot`;--> statement-breakpoint
DROP TABLE `_migration_0058_take_image`;--> statement-breakpoint
DROP TABLE `_migration_0058_take_video`;--> statement-breakpoint
CREATE UNIQUE INDEX `media_generation_run_take_success_idx` ON `media_generation_run` (`target_id`) WHERE "media_generation_run"."purpose" = 'shot.video-take' and "media_generation_run"."target_kind" = 'sceneShotVideoTake' and "media_generation_run"."status" = 'completed';
--> statement-breakpoint
PRAGMA user_version = 45;
