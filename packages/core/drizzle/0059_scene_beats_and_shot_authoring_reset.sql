-- Custom preservation and retirement section for Plan 0144.
--
-- Drizzle Kit owns the schema diff below. The explicit SQL in this section is
-- required because the schema diff cannot transform versioned Beat Sheet JSON,
-- rewrite durable ids, recompute Beat fingerprints, or remove retired Take
-- generation/assets in dependency order.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `scene_shot_list_state` RENAME TO `scene_beat_sheet_state`;--> statement-breakpoint
ALTER TABLE `scene_shot_list` RENAME TO `scene_beat_sheet`;--> statement-breakpoint
ALTER TABLE `scene_shot_storyboard_image` RENAME TO `scene_beat_storyboard_image`;--> statement-breakpoint
ALTER TABLE `scene_beat_sheet_state` RENAME COLUMN "active_shot_list_id" TO "active_beat_sheet_id";--> statement-breakpoint
ALTER TABLE `scene_beat_storyboard_image` RENAME COLUMN "shot_list_id" TO "beat_sheet_id";--> statement-breakpoint
ALTER TABLE `scene_beat_storyboard_image` RENAME COLUMN "shot_id" TO "beat_id";--> statement-breakpoint
ALTER TABLE `scene_beat_storyboard_image` RENAME COLUMN "shot_content_fingerprint" TO "beat_content_fingerprint";--> statement-breakpoint

CREATE TEMP TABLE `_migration_0059_retired_asset` (
	`asset_id` text PRIMARY KEY NOT NULL
);--> statement-breakpoint
INSERT INTO `_migration_0059_retired_asset` (`asset_id`)
SELECT `id`
FROM `asset`
WHERE `type` IN ('shot.input', 'shot.video-prompt-sheet', 'shot.video-take');--> statement-breakpoint

CREATE TEMP TABLE `_migration_0059_retired_asset_owner_guard` (
	`owner_count` integer NOT NULL CHECK (`owner_count` = 0)
);--> statement-breakpoint
INSERT INTO `_migration_0059_retired_asset_owner_guard` (`owner_count`)
SELECT count(*)
FROM (
	SELECT `asset_id` FROM `project_asset` WHERE `discarded_at` IS NULL
	UNION ALL
	SELECT `asset_id` FROM `cast_asset` WHERE `discarded_at` IS NULL
	UNION ALL
	SELECT `asset_id` FROM `location_asset` WHERE `discarded_at` IS NULL
	UNION ALL
	SELECT `asset_id` FROM `sequence_asset` WHERE `discarded_at` IS NULL
	UNION ALL
	SELECT `asset_id` FROM `scene_asset` WHERE `discarded_at` IS NULL
	UNION ALL
	SELECT `asset_id` FROM `lookbook_image` WHERE `discarded_at` IS NULL
	UNION ALL
	SELECT `asset_id` FROM `lookbook_sheet` WHERE `discarded_at` IS NULL
	UNION ALL
	SELECT `asset_id` FROM `cast_profile_display_asset`
	UNION ALL
	SELECT `asset_id` FROM `location_hero_display_asset`
	UNION ALL
	SELECT `asset_id` FROM `scene_dialogue_audio_take` WHERE `discarded_at` IS NULL
) owner
INNER JOIN `_migration_0059_retired_asset` retired
	ON retired.`asset_id` = owner.`asset_id`;--> statement-breakpoint
DROP TABLE `_migration_0059_retired_asset_owner_guard`;--> statement-breakpoint

DELETE FROM `asset_file_generation`
WHERE `media_generation_run_id` IN (
	SELECT `id`
	FROM `media_generation_run`
	WHERE `target_kind` = 'sceneShotVideoTake'
	   OR `purpose` IN (
	      'shot.first-frame',
	      'shot.last-frame',
	      'shot.video-prompt',
	      'shot.video-take'
	   )
);--> statement-breakpoint
DELETE FROM `media_generation_run`
WHERE `target_kind` = 'sceneShotVideoTake'
   OR `purpose` IN (
      'shot.first-frame',
      'shot.last-frame',
      'shot.video-prompt',
      'shot.video-take'
   );--> statement-breakpoint
DELETE FROM `media_generation_spec`
WHERE `target_kind` = 'sceneShotVideoTake'
   OR `purpose` IN (
      'shot.first-frame',
      'shot.last-frame',
      'shot.video-prompt',
      'shot.video-take'
   );--> statement-breakpoint
DELETE FROM `trash_item`
WHERE `item_kind` IN ('sceneShotVideoTake', 'sceneShotReferenceAsset');--> statement-breakpoint

DELETE FROM `scene_shot_reference_asset`;--> statement-breakpoint
DELETE FROM `scene_shot_video_take_image`;--> statement-breakpoint
DELETE FROM `scene_shot_video_take_video`;--> statement-breakpoint
DELETE FROM `scene_shot_video_take_shot`;--> statement-breakpoint

DELETE FROM `asset_file_generation`
WHERE `asset_file_id` IN (
	SELECT file.`id`
	FROM `asset_file` file
	INNER JOIN `_migration_0059_retired_asset` retired
		ON retired.`asset_id` = file.`asset_id`
);--> statement-breakpoint
DELETE FROM `asset_file`
WHERE `asset_id` IN (SELECT `asset_id` FROM `_migration_0059_retired_asset`);--> statement-breakpoint
DELETE FROM `asset`
WHERE `id` IN (SELECT `asset_id` FROM `_migration_0059_retired_asset`);--> statement-breakpoint
DROP TABLE `_migration_0059_retired_asset`;--> statement-breakpoint

UPDATE `scene_beat_sheet`
SET
	`id` = replace(`id`, 'scene_shot_list_', 'scene_beat_sheet_'),
	`document` = json_set(
		json_remove(
			`document`,
			'$.coverageStrategy',
			'$.baseShotListId',
			'$.shots'
		),
		'$.kind',
		'sceneBeatSheet',
		'$.narrativeProgression',
		json_extract(`document`, '$.coverageStrategy'),
		'$.baseBeatSheetId',
		CASE
			WHEN json_type(`document`, '$.baseShotListId') = 'text'
				THEN replace(
					json_extract(`document`, '$.baseShotListId'),
					'scene_shot_list_',
					'scene_beat_sheet_'
				)
			ELSE NULL
		END,
		'$.beats',
		json((
			SELECT json_group_array(
				json_object(
					'id',
					replace(json_extract(entry.value, '$.shotId'), 'shot_', 'beat_'),
					'title',
					json_extract(entry.value, '$.title'),
					'description',
					json_extract(entry.value, '$.description'),
					'narrativeDevelopment',
					json_extract(entry.value, '$.storyBeat'),
					'narrativePurpose',
					json_extract(entry.value, '$.narrativePurpose'),
					'castMemberIds',
					json_extract(entry.value, '$.castMemberIds'),
					'locationIds',
					json_extract(entry.value, '$.locationIds'),
					'screenplayBlockIndexes',
					json_extract(entry.value, '$.coveredBlockIndexes')
				)
			)
			FROM json_each(`scene_beat_sheet`.`document`, '$.shots') entry
		))
	);--> statement-breakpoint

UPDATE `scene_beat_sheet_state`
SET `active_beat_sheet_id` = replace(
	`active_beat_sheet_id`,
	'scene_shot_list_',
	'scene_beat_sheet_'
);--> statement-breakpoint

UPDATE `scene_beat_storyboard_image`
SET
	`id` = replace(
		`id`,
		'scene_shot_storyboard_image_',
		'scene_beat_storyboard_image_'
	),
	`beat_sheet_id` = replace(
		`beat_sheet_id`,
		'scene_shot_list_',
		'scene_beat_sheet_'
	),
	`beat_id` = replace(`beat_id`, 'shot_', 'beat_');--> statement-breakpoint

UPDATE `scene_beat_storyboard_image`
SET `beat_content_fingerprint` = (
	SELECT json_object(
		'title',
		json_extract(entry.value, '$.title'),
		'description',
		json_extract(entry.value, '$.description'),
		'narrativeDevelopment',
		json_extract(entry.value, '$.narrativeDevelopment'),
		'narrativePurpose',
		json_extract(entry.value, '$.narrativePurpose'),
		'castMemberIds',
		json_extract(entry.value, '$.castMemberIds'),
		'locationIds',
		json_extract(entry.value, '$.locationIds'),
		'screenplayBlockIndexes',
		json_extract(entry.value, '$.screenplayBlockIndexes')
	)
	FROM `scene_beat_sheet` sheet,
	     json_each(sheet.`document`, '$.beats') entry
	WHERE sheet.`id` = `scene_beat_storyboard_image`.`beat_sheet_id`
	  AND json_extract(entry.value, '$.id') = `scene_beat_storyboard_image`.`beat_id`
);--> statement-breakpoint

DROP TABLE `scene_shot_reference_asset`;--> statement-breakpoint
DROP TABLE `scene_shot_video_take_image`;--> statement-breakpoint
DROP TABLE `scene_shot_video_take_shot`;--> statement-breakpoint
DROP TABLE `scene_shot_video_take_video`;--> statement-breakpoint
DROP TABLE `scene_shot_video_take`;--> statement-breakpoint
DROP INDEX `scene_shot_list_scene_updated_idx`;--> statement-breakpoint
CREATE INDEX `scene_beat_sheet_scene_updated_idx` ON `scene_beat_sheet` (`scene_id`,`updated_at`,`id`);--> statement-breakpoint
DROP INDEX `scene_shot_storyboard_image_scene_idx`;--> statement-breakpoint
DROP INDEX `scene_shot_storyboard_image_shot_list_idx`;--> statement-breakpoint
DROP INDEX `scene_shot_storyboard_image_asset_idx`;--> statement-breakpoint
CREATE INDEX `scene_beat_storyboard_image_scene_idx` ON `scene_beat_storyboard_image` (`scene_id`);--> statement-breakpoint
CREATE INDEX `scene_beat_storyboard_image_beat_sheet_idx` ON `scene_beat_storyboard_image` (`beat_sheet_id`,`beat_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `scene_beat_storyboard_image_asset_idx` ON `scene_beat_storyboard_image` (`asset_id`);--> statement-breakpoint
DROP INDEX `media_generation_run_take_success_idx`;--> statement-breakpoint
DROP INDEX `media_generation_spec_take_purpose_idx`;--> statement-breakpoint
PRAGMA user_version = 46;
