CREATE TABLE IF NOT EXISTS `location_environment_sheet` (
	`composite_file_id` text
);--> statement-breakpoint
UPDATE `asset_file`
SET `role` = 'primary'
WHERE `role` = 'composite'
  AND `media_kind` = 'image'
  AND `id` IN (
    SELECT `location_environment_sheet`.`composite_file_id`
    FROM `location_environment_sheet`
  )
  AND NOT EXISTS (
    SELECT 1
    FROM `asset_file` AS `primary_file`
    WHERE `primary_file`.`asset_id` = `asset_file`.`asset_id`
      AND `primary_file`.`role` = 'primary'
      AND `primary_file`.`media_kind` = 'image'
  );--> statement-breakpoint
UPDATE `location_asset`
SET `selection` = 'take',
    `selection_order` = NULL
WHERE `role` = 'environment_sheet'
  AND `selection` = 'select';--> statement-breakpoint
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
INSERT INTO `__new_scene_shot_video_take`("id", "scene_id", "source_shot_list_id", "title", "state_json", "is_picked", "history_snapshot_json", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at") SELECT "id", "scene_id", "source_shot_list_id", "title", CASE
	WHEN json_type("state_json", '$.referenceSelections.referencedLocationSheetAssetIds') = 'object' THEN json_remove(
		"state_json",
		'$.referenceSelections.selectedLocationSheetAssetIds',
		'$.referenceSelections.selectedLocationViewIds'
	)
	ELSE json_remove(
		json_set(
			"state_json",
			'$.referenceSelections.referencedLocationSheetAssetIds',
			COALESCE(
				(
					SELECT json_group_object(`selected_location_sheet`.`key`, json_array(`selected_location_sheet`.`value`))
					FROM json_each("state_json", '$.referenceSelections.selectedLocationSheetAssetIds') AS `selected_location_sheet`
					WHERE `selected_location_sheet`.`type` = 'text'
				),
				json('{}')
			)
		),
		'$.referenceSelections.selectedLocationSheetAssetIds',
		'$.referenceSelections.selectedLocationViewIds'
	)
END, "is_picked", "history_snapshot_json", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at" FROM `scene_shot_video_take`;--> statement-breakpoint
DROP TABLE `scene_shot_video_take`;--> statement-breakpoint
ALTER TABLE `__new_scene_shot_video_take` RENAME TO `scene_shot_video_take`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_scene_idx` ON `scene_shot_video_take` (`scene_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_source_shot_list_idx` ON `scene_shot_video_take` (`source_shot_list_id`,`created_at`,`id`);
--> statement-breakpoint
DROP TABLE IF EXISTS `location_environment_sheet_view`;--> statement-breakpoint
DROP TABLE IF EXISTS `location_environment_sheet`;
