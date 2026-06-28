PRAGMA user_version = 29;--> statement-breakpoint
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
	`state_json` text DEFAULT '{"version":2,"structure":{"mode":"continuous","sharedDirection":{"referenceSelections":{"dependencyInclusions":{},"selectedCharacterSheetAssetIds":{},"referencedLocationSheetAssetIds":{},"selectedLookbookSheetIds":[],"selectedDialogueAudioTakeIds":{}}}},"production":{}}' NOT NULL,
	`is_picked` integer DEFAULT false NOT NULL,
	`history_snapshot_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_shot_list_id`) REFERENCES `scene_shot_list`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_scene_shot_video_take` (
	"id",
	"scene_id",
	"source_shot_list_id",
	"title",
	"state_json",
	"is_picked",
	"history_snapshot_json",
	"created_at",
	"updated_at",
	"discarded_at",
	"discard_operation_id",
	"restored_at"
)
SELECT
	"id",
	"scene_id",
	"source_shot_list_id",
	"title",
	CASE
		WHEN json_extract("state_json", '$.version') = 2 THEN "state_json"
		ELSE json_patch(
			json_object(
				'version',
				2,
				'structure',
				json_object(
					'mode',
					'multi-cut',
					'directionsByShotId',
					json(
						COALESCE(
							(
								SELECT json_group_object(
									`take_shot`.`shot_id`,
									json_patch(
										COALESCE(
											(
												SELECT json(`shot_direction`.`value`)
												FROM json_each(
													`scene_shot_video_take`.`state_json`,
													'$.shotDesignByShotId'
												) AS `shot_direction`
												WHERE `shot_direction`.`key` = `take_shot`.`shot_id`
											),
											json('{}')
										),
										json_object(
											'referenceSelections',
											json(
												COALESCE(
													json_extract(
														`scene_shot_video_take`.`state_json`,
														'$.referenceSelections'
													),
													'{}'
												)
											)
										)
									)
								)
								FROM `scene_shot_video_take_shot` AS `take_shot`
								WHERE `take_shot`.`take_id` = `scene_shot_video_take`.`id`
							),
							'{}'
						)
					)
				),
				'production',
				json(
					COALESCE(
						json_extract("state_json", '$.production'),
						'{}'
					)
				)
			),
			CASE
				WHEN json_type("state_json", '$.promptState') IS NULL THEN json('{}')
				ELSE json_object(
					'promptState',
					json(json_extract("state_json", '$.promptState'))
				)
			END
		)
	END,
	"is_picked",
	"history_snapshot_json",
	"created_at",
	"updated_at",
	"discarded_at",
	"discard_operation_id",
	"restored_at"
FROM `scene_shot_video_take`;--> statement-breakpoint
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
