PRAGMA foreign_keys = OFF;--> statement-breakpoint
CREATE TABLE `__scene_shot_video_take_regenerated_fk_repair` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`source_shot_list_id` text NOT NULL,
	`title` text NOT NULL,
	`state_json` text DEFAULT '{"version":2,"structure":{"mode":"continuous","sharedDirection":{"referenceSelections":{"dependencyInclusions":{},"selectedCharacterSheetAssetIds":{},"selectedLocationSheetAssetIds":{},"selectedLookbookSheetIds":[],"selectedDialogueAudioTakeIds":{}}}},"production":{}}' NOT NULL,
	`is_picked` integer DEFAULT false NOT NULL,
	`regenerated_from_take_id` text,
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
INSERT INTO `__scene_shot_video_take_regenerated_fk_repair` (
	`id`,
	`scene_id`,
	`source_shot_list_id`,
	`title`,
	`state_json`,
	`is_picked`,
	`regenerated_from_take_id`,
	`history_snapshot_json`,
	`created_at`,
	`updated_at`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
)
SELECT
	`id`,
	`scene_id`,
	`source_shot_list_id`,
	`title`,
	`state_json`,
	`is_picked`,
	`regenerated_from_take_id`,
	`history_snapshot_json`,
	`created_at`,
	`updated_at`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
FROM `scene_shot_video_take`;
--> statement-breakpoint
DROP TABLE `scene_shot_video_take`;--> statement-breakpoint
ALTER TABLE `__scene_shot_video_take_regenerated_fk_repair` RENAME TO `scene_shot_video_take`;--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_scene_idx` ON `scene_shot_video_take` (`scene_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_source_shot_list_idx` ON `scene_shot_video_take` (`source_shot_list_id`,`created_at`,`id`);--> statement-breakpoint
PRAGMA foreign_keys = ON;--> statement-breakpoint
PRAGMA user_version = 35;
