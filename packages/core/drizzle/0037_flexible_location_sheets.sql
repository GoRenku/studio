DROP TABLE IF EXISTS `location_environment_sheet_view`;--> statement-breakpoint
DROP TABLE IF EXISTS `location_environment_sheet`;--> statement-breakpoint
PRAGMA user_version = 28;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_scene_shot_video_take` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`source_shot_list_id` text NOT NULL,
	`title` text NOT NULL,
	`state_json` text DEFAULT '{"version":1,"shotDesignByShotId":{},"referenceSelections":{"dependencyInclusions":{},"selectedCharacterSheetAssetIds":{},"referencedLocationSheetAssetIds":{},"selectedLookbookSheetIds":[],"selectedDialogueAudioTakeIds":{}},"production":{}}' NOT NULL,
	`is_picked` integer DEFAULT false NOT NULL,
	`history_snapshot_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_shot_list_id`) REFERENCES `scene_shot_list`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_scene_shot_video_take`("id", "scene_id", "source_shot_list_id", "title", "state_json", "is_picked", "history_snapshot_json", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at") SELECT "id", "scene_id", "source_shot_list_id", "title", "state_json", "is_picked", "history_snapshot_json", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at" FROM `scene_shot_video_take`;--> statement-breakpoint
DROP TABLE `scene_shot_video_take`;--> statement-breakpoint
ALTER TABLE `__new_scene_shot_video_take` RENAME TO `scene_shot_video_take`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_scene_idx` ON `scene_shot_video_take` (`scene_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_source_shot_list_idx` ON `scene_shot_video_take` (`source_shot_list_id`,`created_at`,`id`);
