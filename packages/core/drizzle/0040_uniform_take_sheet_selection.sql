PRAGMA user_version = 30;--> statement-breakpoint
-- Custom data repair for ADR 0039 / plan 0091.
--
-- Shot Video Take direction state now stores one selected Location Sheet asset
-- per Location. Existing development databases may contain the previous
-- array-shaped referencedLocationSheetAssetIds field. This one-way repair
-- keeps the first asset id from each non-empty array as the current selected
-- sheet and removes obsolete Location Sheet take-selection fields.
UPDATE `scene_shot_video_take`
SET `state_json` = CASE
	WHEN json_extract(`state_json`, '$.structure.mode') = 'continuous' THEN
		json_set(
			`state_json`,
			'$.structure.sharedDirection.referenceSelections',
			json_remove(
				json_set(
					json(
						COALESCE(
							json_extract(
								`state_json`,
								'$.structure.sharedDirection.referenceSelections'
							),
							'{}'
						)
					),
					'$.selectedLocationSheetAssetIds',
					json(
						COALESCE(
							(
								SELECT json_group_object(
									`location_sheet`.`key`,
									json_extract(`location_sheet`.`value`, '$[0]')
								)
								FROM json_each(
									`state_json`,
									'$.structure.sharedDirection.referenceSelections.referencedLocationSheetAssetIds'
								) AS `location_sheet`
								WHERE `location_sheet`.`type` = 'array'
									AND json_array_length(`location_sheet`.`value`) > 0
							),
							'{}'
						)
					)
				),
				'$.referencedLocationSheetAssetIds',
				'$.selectedLocationViewIds'
			)
		)
	WHEN json_extract(`state_json`, '$.structure.mode') = 'multi-cut' THEN
		json_set(
			`state_json`,
			'$.structure.directionsByShotId',
			json(
				COALESCE(
					(
						SELECT json_group_object(
							`shot_direction`.`key`,
							json_set(
								json(`shot_direction`.`value`),
								'$.referenceSelections',
								json_remove(
									json_set(
										json(
											COALESCE(
												json_extract(
													`shot_direction`.`value`,
													'$.referenceSelections'
												),
												'{}'
											)
										),
										'$.selectedLocationSheetAssetIds',
										json(
											COALESCE(
												(
													SELECT json_group_object(
														`location_sheet`.`key`,
														json_extract(`location_sheet`.`value`, '$[0]')
													)
													FROM json_each(
														`shot_direction`.`value`,
														'$.referenceSelections.referencedLocationSheetAssetIds'
													) AS `location_sheet`
													WHERE `location_sheet`.`type` = 'array'
														AND json_array_length(`location_sheet`.`value`) > 0
												),
												'{}'
											)
										)
									),
									'$.referencedLocationSheetAssetIds',
									'$.selectedLocationViewIds'
								)
							)
						)
						FROM json_each(
							`state_json`,
							'$.structure.directionsByShotId'
						) AS `shot_direction`
					),
					'{}'
				)
			)
		)
	ELSE `state_json`
END
WHERE json_type(`state_json`, '$.structure') = 'object';--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TEMP TABLE `__scene_shot_video_take_shot_backup` AS SELECT * FROM `scene_shot_video_take_shot`;--> statement-breakpoint
CREATE TEMP TABLE `__scene_shot_video_take_media_input_backup` AS SELECT * FROM `scene_shot_video_take_media_input`;--> statement-breakpoint
CREATE TEMP TABLE `__scene_shot_video_take_media_input_shot_backup` AS SELECT * FROM `scene_shot_video_take_media_input_shot`;--> statement-breakpoint
CREATE TEMP TABLE `__scene_shot_video_take_output_backup` AS SELECT * FROM `scene_shot_video_take_output`;--> statement-breakpoint
CREATE TEMP TABLE `__scene_shot_video_take_output_shot_backup` AS SELECT * FROM `scene_shot_video_take_output_shot`;--> statement-breakpoint
CREATE TABLE `__new_scene_shot_video_take` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`source_shot_list_id` text NOT NULL,
	`title` text NOT NULL,
	`state_json` text DEFAULT '{"version":2,"structure":{"mode":"continuous","sharedDirection":{"referenceSelections":{"dependencyInclusions":{},"selectedCharacterSheetAssetIds":{},"selectedLocationSheetAssetIds":{},"selectedLookbookSheetIds":[],"selectedDialogueAudioTakeIds":{}}}},"production":{}}' NOT NULL,
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
INSERT OR IGNORE INTO `scene_shot_video_take_shot` SELECT * FROM `__scene_shot_video_take_shot_backup`;--> statement-breakpoint
INSERT OR IGNORE INTO `scene_shot_video_take_media_input` SELECT * FROM `__scene_shot_video_take_media_input_backup`;--> statement-breakpoint
INSERT OR IGNORE INTO `scene_shot_video_take_media_input_shot` SELECT * FROM `__scene_shot_video_take_media_input_shot_backup`;--> statement-breakpoint
INSERT OR IGNORE INTO `scene_shot_video_take_output` SELECT * FROM `__scene_shot_video_take_output_backup`;--> statement-breakpoint
INSERT OR IGNORE INTO `scene_shot_video_take_output_shot` SELECT * FROM `__scene_shot_video_take_output_shot_backup`;--> statement-breakpoint
DROP TABLE `__scene_shot_video_take_shot_backup`;--> statement-breakpoint
DROP TABLE `__scene_shot_video_take_media_input_backup`;--> statement-breakpoint
DROP TABLE `__scene_shot_video_take_media_input_shot_backup`;--> statement-breakpoint
DROP TABLE `__scene_shot_video_take_output_backup`;--> statement-breakpoint
DROP TABLE `__scene_shot_video_take_output_shot_backup`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_scene_idx` ON `scene_shot_video_take` (`scene_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_source_shot_list_idx` ON `scene_shot_video_take` (`source_shot_list_id`,`created_at`,`id`);
