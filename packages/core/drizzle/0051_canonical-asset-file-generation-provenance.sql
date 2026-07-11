PRAGMA foreign_keys=OFF;--> statement-breakpoint
WITH `generation_output_candidate` AS (
	SELECT
		`file`.`id` AS `asset_file_id`,
		`run`.`id` AS `media_generation_run_id`,
		json_extract(`output`.`value`, '$.artifactId') AS `output_artifact_id`,
		coalesce(`run`.`completed_at`, `run`.`started_at`, `file`.`created_at`) AS `created_at`
	FROM `asset_file` AS `file`
	INNER JOIN `media_generation_run` AS `run`
		ON `run`.`status` IN ('completed', 'simulated')
	INNER JOIN json_each(`run`.`outputs_json`) AS `output`
	WHERE `file`.`discarded_at` IS NULL
		AND `file`.`content_hash` IS NOT NULL
		AND replace(json_extract(`output`.`value`, '$.contentHash'), 'sha256:', '') = replace(`file`.`content_hash`, 'sha256:', '')
		AND (
			json_extract(`output`.`value`, '$.mimeType') IS NULL
			OR json_extract(`output`.`value`, '$.mimeType') LIKE `file`.`media_kind` || '/%'
		)
),
`unique_generation_output` AS (
	SELECT
		`asset_file_id`,
		min(`media_generation_run_id`) AS `media_generation_run_id`,
		min(`output_artifact_id`) AS `output_artifact_id`,
		min(`created_at`) AS `created_at`
	FROM `generation_output_candidate`
	GROUP BY `asset_file_id`
	HAVING count(DISTINCT `media_generation_run_id`) = 1
)
INSERT OR IGNORE INTO `asset_file_generation` (
	`asset_file_id`,
	`media_generation_run_id`,
	`output_artifact_id`,
	`created_at`
)
SELECT
	`asset_file_id`,
	`media_generation_run_id`,
	`output_artifact_id`,
	`created_at`
FROM `unique_generation_output`;--> statement-breakpoint
CREATE TEMP TABLE `__preserved_scene_shot_video_take_media_input_shot` AS
SELECT * FROM `scene_shot_video_take_media_input_shot`;--> statement-breakpoint
CREATE TABLE `__new_scene_shot_video_take_media_input` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`take_id` text NOT NULL,
	`input_kind` text NOT NULL,
	`subject_kind` text NOT NULL,
	`subject_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`asset_file_id` text NOT NULL,
	`selection` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`take_id`) REFERENCES `scene_shot_video_take`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_scene_shot_video_take_media_input`("id", "scene_id", "take_id", "input_kind", "subject_kind", "subject_id", "asset_id", "asset_file_id", "selection", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at") SELECT "id", "scene_id", "take_id", "input_kind", "subject_kind", "subject_id", "asset_id", "asset_file_id", "selection", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at" FROM `scene_shot_video_take_media_input`;--> statement-breakpoint
DROP TABLE `scene_shot_video_take_media_input`;--> statement-breakpoint
ALTER TABLE `__new_scene_shot_video_take_media_input` RENAME TO `scene_shot_video_take_media_input`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_media_input_take_idx` ON `scene_shot_video_take_media_input` (`scene_id`,`take_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_media_input_asset_idx` ON `scene_shot_video_take_media_input` (`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_media_input_selected_idx` ON `scene_shot_video_take_media_input` (`scene_id`,`take_id`,`input_kind`,`subject_kind`,`subject_id`) WHERE "scene_shot_video_take_media_input"."selection" = 'select' and "scene_shot_video_take_media_input"."discarded_at" is null;--> statement-breakpoint
INSERT OR IGNORE INTO `scene_shot_video_take_media_input_shot` (
	`input_id`,
	`shot_id`,
	`shot_order`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
)
SELECT
	`input_id`,
	`shot_id`,
	`shot_order`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
FROM `__preserved_scene_shot_video_take_media_input_shot`;--> statement-breakpoint
DROP TABLE `__preserved_scene_shot_video_take_media_input_shot`;--> statement-breakpoint
CREATE TABLE `__new_scene_shot_video_take_video` (
	`take_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`asset_file_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`take_id`) REFERENCES `scene_shot_video_take`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_scene_shot_video_take_video`("take_id", "asset_id", "asset_file_id", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at") SELECT "take_id", "asset_id", "asset_file_id", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at" FROM `scene_shot_video_take_video`;--> statement-breakpoint
DROP TABLE `scene_shot_video_take_video`;--> statement-breakpoint
ALTER TABLE `__new_scene_shot_video_take_video` RENAME TO `scene_shot_video_take_video`;--> statement-breakpoint
CREATE UNIQUE INDEX `scene_shot_video_take_video_take_id_unique` ON `scene_shot_video_take_video` (`take_id`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_video_take_idx` ON `scene_shot_video_take_video` (`take_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_video_asset_idx` ON `scene_shot_video_take_video` (`asset_id`);--> statement-breakpoint
CREATE TABLE `__new_scene_dialogue_audio_take` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_dialogue_audio_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`asset_file_id` text NOT NULL,
	`model_choice` text NOT NULL,
	`cast_voice_id` text NOT NULL,
	`cast_voice_name` text NOT NULL,
	`provider` text NOT NULL,
	`provider_voice_id` text NOT NULL,
	`provider_text_snapshot` text NOT NULL,
	`plain_text_snapshot` text NOT NULL,
	`v3_text_snapshot` text NOT NULL,
	`text_treatment` text NOT NULL,
	`voice_settings_snapshot_json` text NOT NULL,
	`output_format` text NOT NULL,
	`language_code` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`scene_dialogue_audio_id`) REFERENCES `scene_dialogue_audio`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cast_voice_id`) REFERENCES `cast_voice`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_scene_dialogue_audio_take`("id", "scene_dialogue_audio_id", "asset_id", "asset_file_id", "model_choice", "cast_voice_id", "cast_voice_name", "provider", "provider_voice_id", "provider_text_snapshot", "plain_text_snapshot", "v3_text_snapshot", "text_treatment", "voice_settings_snapshot_json", "output_format", "language_code", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at") SELECT "id", "scene_dialogue_audio_id", "asset_id", "asset_file_id", "model_choice", "cast_voice_id", "cast_voice_name", "provider", "provider_voice_id", "provider_text_snapshot", "plain_text_snapshot", "v3_text_snapshot", "text_treatment", "voice_settings_snapshot_json", "output_format", "language_code", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at" FROM `scene_dialogue_audio_take`;--> statement-breakpoint
DROP TABLE `scene_dialogue_audio_take`;--> statement-breakpoint
ALTER TABLE `__new_scene_dialogue_audio_take` RENAME TO `scene_dialogue_audio_take`;--> statement-breakpoint
CREATE INDEX `scene_dialogue_audio_take_audio_idx` ON `scene_dialogue_audio_take` (`scene_dialogue_audio_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scene_dialogue_audio_take_asset_idx` ON `scene_dialogue_audio_take` (`asset_id`);--> statement-breakpoint
PRAGMA user_version = 41;
