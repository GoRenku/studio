CREATE TABLE `cast_voice_default` (
	`cast_member_id` text PRIMARY KEY NOT NULL,
	`cast_voice_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cast_voice_id`) REFERENCES `cast_voice`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cast_voice_default_cast_voice_id_unique` ON `cast_voice_default` (`cast_voice_id`);--> statement-breakpoint
CREATE INDEX `cast_voice_default_voice_idx` ON `cast_voice_default` (`cast_voice_id`);--> statement-breakpoint
CREATE TABLE `shot_plan_dialogue_audio_take` (
	`id` text PRIMARY KEY NOT NULL,
	`shot_plan_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`asset_file_id` text NOT NULL,
	`turn_start_number` integer NOT NULL,
	`turn_end_number` integer NOT NULL,
	`selected_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`shot_plan_id`) REFERENCES `shot_plan`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shot_plan_dialogue_audio_take_start_positive" CHECK("shot_plan_dialogue_audio_take"."turn_start_number" > 0),
	CONSTRAINT "shot_plan_dialogue_audio_take_range_ascending" CHECK("shot_plan_dialogue_audio_take"."turn_end_number" >= "shot_plan_dialogue_audio_take"."turn_start_number")
);
--> statement-breakpoint
CREATE INDEX `shot_plan_dialogue_audio_take_plan_idx` ON `shot_plan_dialogue_audio_take` (`shot_plan_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_dialogue_audio_take_asset_idx` ON `shot_plan_dialogue_audio_take` (`asset_id`);--> statement-breakpoint
ALTER TABLE `cast_voice` ADD `voice_identity` text;--> statement-breakpoint

CREATE TEMP TABLE `_dialogue_audio_settings_guard` (`valid` integer NOT NULL CHECK (`valid` = 1));--> statement-breakpoint
INSERT INTO `_dialogue_audio_settings_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1 FROM `project_settings`
	WHERE json_valid(`document`) = 0
		OR json_type(`document`) <> 'object'
		OR json_type(`document`, '$.version') <> 'integer'
		OR json_extract(`document`, '$.version') <> 5
		OR json_type(`document`, '$.generation.audio.provider') <> 'text'
		OR trim(json_extract(`document`, '$.generation.audio.provider')) = ''
) THEN 0 ELSE 1 END;--> statement-breakpoint

-- Provider facts are guarded before they are converted into opaque Core JSON.
CREATE TEMP TABLE `_cast_voice_conversion_guard` (`valid` integer NOT NULL CHECK (`valid` = 1));--> statement-breakpoint
INSERT INTO `_cast_voice_conversion_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1 FROM `cast_voice_provider_registration` AS `registration`
	LEFT JOIN `cast_voice` AS `voice` ON `voice`.`id` = `registration`.`cast_voice_id`
	WHERE `registration`.`discarded_at` IS NULL
		AND (`voice`.`id` IS NULL OR `voice`.`discarded_at` IS NOT NULL)
) THEN 0 ELSE 1 END;--> statement-breakpoint
INSERT INTO `_cast_voice_conversion_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT `cast_voice_id` FROM `cast_voice_provider_registration`
	WHERE `discarded_at` IS NULL GROUP BY `cast_voice_id` HAVING count(*) > 1
) THEN 0 ELSE 1 END;--> statement-breakpoint
INSERT INTO `_cast_voice_conversion_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1 FROM `cast_voice_provider_registration`
	WHERE `discarded_at` IS NULL AND NOT (
		(`cast_voice_id` = 'cast_voice_6rwp8wx4' AND `provider` = 'elevenlabs' AND `external_voice_id` = 'iUqOXhMfiOIbBejNtfLR')
		OR (`cast_voice_id` = 'cast_voice_t8wv3u67' AND `provider` = 'elevenlabs' AND `external_voice_id` = '7squ7rvxEIZ2rYy7KYPP')
		OR (`cast_voice_id` = 'cast_voice_h3tjb82r' AND `provider` = 'elevenlabs' AND `external_voice_id` = '4qGY1svUBZLI7l8Ei9WW')
		OR (`cast_voice_id` = 'cast_voice_dmespd7e' AND `provider` = 'elevenlabs' AND `external_voice_id` = 'Xq2dbIWNPChFB77imiDe')
	)
) THEN 0 ELSE 1 END;--> statement-breakpoint
INSERT INTO `_cast_voice_conversion_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1 FROM `cast_voice`
	WHERE `discarded_at` IS NULL
		AND (`sample_source_kind` <> 'custom_file' OR `sample_id` IS NOT NULL
			OR `sample_fetched_at` IS NOT NULL OR `sample_api_base_url` IS NOT NULL)
		AND NOT (`id` = 'cast_voice_6rwp8wx4'
			AND `sample_source_kind` = 'elevenlabs_voice_sample'
			AND `sample_id` = 'kD3H159cQN5vDGml2QJz'
			AND `sample_fetched_at` = '2026-07-01T15:09:21.370Z'
			AND `sample_api_base_url` = 'https://api.elevenlabs.io')
		AND NOT (`id` = 'cast_voice_t8wv3u67' AND `sample_source_kind` = 'generated_sample'
			AND `sample_id` IS NULL AND `sample_fetched_at` IS NULL AND `sample_api_base_url` IS NULL)
) THEN 0 ELSE 1 END;--> statement-breakpoint

CREATE TEMP TABLE `_dialogue_audio_take_conversion_guard` (`valid` integer NOT NULL CHECK (`valid` = 1));--> statement-breakpoint
INSERT INTO `_dialogue_audio_take_conversion_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1 FROM `scene_dialogue_audio_take`
	WHERE `discarded_at` IS NULL AND `id` NOT IN (
		'scene_dialogue_audio_take_x9j47jps', 'scene_dialogue_audio_take_jrudpeny',
		'scene_dialogue_audio_take_gm7cnaxq', 'scene_dialogue_audio_take_axxxsn8z',
		'scene_dialogue_audio_take_4kznq7a8'
	)
) THEN 0 ELSE 1 END;--> statement-breakpoint
INSERT INTO `_dialogue_audio_take_conversion_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1 FROM `scene_dialogue_audio_take` WHERE `discarded_at` IS NULL
) AND (
	NOT EXISTS (SELECT 1 FROM `shot_plan` WHERE `id` = 'shot_plan_bm34r9be')
	OR NOT EXISTS (SELECT 1 FROM `shot_plan` WHERE `id` = 'shot_plan_sp24knrj')
) THEN 0 ELSE 1 END;--> statement-breakpoint

UPDATE `cast_voice`
SET `voice_identity` = (
	SELECT json_object('provider', `registration`.`provider`, 'voiceId', `registration`.`external_voice_id`)
	FROM `cast_voice_provider_registration` AS `registration`
	WHERE `registration`.`cast_voice_id` = `cast_voice`.`id` AND `registration`.`discarded_at` IS NULL
)
WHERE EXISTS (
	SELECT 1 FROM `cast_voice_provider_registration` AS `registration`
	WHERE `registration`.`cast_voice_id` = `cast_voice`.`id` AND `registration`.`discarded_at` IS NULL
);--> statement-breakpoint

UPDATE `asset`
SET `generation_provenance` = json_object(
	'provider', 'elevenlabs', 'model', 'voice-sample-audio', 'mediaKind', 'audio', 'prompt', NULL,
	'request', json_object('voiceId', 'iUqOXhMfiOIbBejNtfLR'),
	'receipt', json_object(
		'sampleId', 'kD3H159cQN5vDGml2QJz',
		'fetchedAt', '2026-07-01T15:09:21.370Z',
		'apiBaseUrl', 'https://api.elevenlabs.io'
	)
)
WHERE `id` = (SELECT `sample_asset_id` FROM `cast_voice` WHERE `id` = 'cast_voice_6rwp8wx4');--> statement-breakpoint

INSERT INTO `cast_voice_default` (`cast_member_id`, `cast_voice_id`, `created_at`, `updated_at`)
SELECT `voice`.`cast_member_id`, `voice`.`id`, `voice`.`created_at`, `voice`.`updated_at`
FROM `cast_voice` AS `voice`
WHERE `voice`.`discarded_at` IS NULL AND NOT EXISTS (
	SELECT 1 FROM `cast_voice` AS `earlier`
	WHERE `earlier`.`cast_member_id` = `voice`.`cast_member_id` AND `earlier`.`discarded_at` IS NULL
		AND (`earlier`.`sort_order` < `voice`.`sort_order`
			OR (`earlier`.`sort_order` = `voice`.`sort_order` AND `earlier`.`id` < `voice`.`id`))
);--> statement-breakpoint

INSERT INTO `shot_plan_dialogue_audio_take` (
	`id`, `shot_plan_id`, `asset_id`, `asset_file_id`, `turn_start_number`, `turn_end_number`,
	`selected_at`, `created_at`, `updated_at`, `discarded_at`, `discard_operation_id`, `restored_at`
)
SELECT `id`,
	CASE WHEN `id` = 'scene_dialogue_audio_take_x9j47jps' THEN 'shot_plan_bm34r9be' ELSE 'shot_plan_sp24knrj' END,
	`asset_id`, `asset_file_id`,
	CASE
		WHEN `id` = 'scene_dialogue_audio_take_x9j47jps' THEN 1
		WHEN `id` IN ('scene_dialogue_audio_take_jrudpeny', 'scene_dialogue_audio_take_gm7cnaxq') THEN 2
		WHEN `id` = 'scene_dialogue_audio_take_axxxsn8z' THEN 3 ELSE 4
	END,
	CASE
		WHEN `id` = 'scene_dialogue_audio_take_x9j47jps' THEN 1
		WHEN `id` IN ('scene_dialogue_audio_take_jrudpeny', 'scene_dialogue_audio_take_gm7cnaxq') THEN 2
		WHEN `id` = 'scene_dialogue_audio_take_axxxsn8z' THEN 3 ELSE 4
	END,
	NULL, `created_at`, `updated_at`, `discarded_at`, `discard_operation_id`, `restored_at`
FROM `scene_dialogue_audio_take` WHERE `discarded_at` IS NULL;--> statement-breakpoint

UPDATE `asset`
SET `type` = 'shot_plan_dialogue_audio',
	`authored_from_shot_plan_id` = CASE WHEN `id` = 'asset_86j7tf8v'
		THEN 'shot_plan_bm34r9be' ELSE 'shot_plan_sp24knrj' END
WHERE `id` IN ('asset_86j7tf8v', 'asset_bfpjnwrm', 'asset_nrgfy5mk', 'asset_x76fre6p', 'asset_d796u6cw');--> statement-breakpoint
UPDATE `asset_membership`
SET `owner_key` = 'project', `updated_at` = (
	SELECT `updated_at` FROM `asset` WHERE `asset`.`id` = `asset_membership`.`asset_id`
)
WHERE `asset_id` IN ('asset_86j7tf8v', 'asset_bfpjnwrm', 'asset_nrgfy5mk', 'asset_x76fre6p', 'asset_d796u6cw');--> statement-breakpoint
UPDATE `project_settings` SET `document` = json_set(`document`, '$.version', 6);--> statement-breakpoint

DROP TABLE `_dialogue_audio_settings_guard`;--> statement-breakpoint
DROP TABLE `_cast_voice_conversion_guard`;--> statement-breakpoint
DROP TABLE `_dialogue_audio_take_conversion_guard`;--> statement-breakpoint
DROP TABLE `scene_dialogue_audio_take_selection`;--> statement-breakpoint
DROP TABLE `scene_dialogue_audio_take`;--> statement-breakpoint
DROP TABLE `scene_dialogue_audio`;--> statement-breakpoint
DROP TABLE `cast_voice_provider_registration`;--> statement-breakpoint
ALTER TABLE `cast_voice` DROP COLUMN `sample_source_kind`;--> statement-breakpoint
ALTER TABLE `cast_voice` DROP COLUMN `sample_id`;--> statement-breakpoint
ALTER TABLE `cast_voice` DROP COLUMN `sample_fetched_at`;--> statement-breakpoint
ALTER TABLE `cast_voice` DROP COLUMN `sample_api_base_url`;--> statement-breakpoint
PRAGMA user_version = 67;
