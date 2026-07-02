PRAGMA user_version = 36;--> statement-breakpoint
-- Repair project databases where take-owned relationship rows were lost after
-- the shot video take output-to-video migration. The durable sources are the
-- active take history snapshot, active take state, generation runs, and asset
-- file paths.
INSERT OR IGNORE INTO `scene_shot_video_take_shot` (
	`take_id`,
	`shot_id`,
	`shot_order`,
	`shot_content_fingerprint`,
	`storyboard_image_id`,
	`storyboard_asset_file_id`,
	`storyboard_content_fingerprint`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
)
WITH `recovered_take_shots` AS (
	SELECT
		`take`.`id` AS `take_id`,
		`take`.`source_shot_list_id` AS `shot_list_id`,
		CAST(`selected_shot`.`key` AS integer) AS `shot_order`,
		`selected_shot`.`value` AS `shot_id`,
		`shot`.`value` AS `shot_json`
	FROM `scene_shot_video_take` AS `take`
	INNER JOIN `scene_shot_list` AS `shot_list`
		ON `shot_list`.`id` = `take`.`source_shot_list_id`
	INNER JOIN json_each(
		`take`.`history_snapshot_json`,
		'$.selectedShotIds'
	) AS `selected_shot`
	INNER JOIN json_each(`shot_list`.`document`, '$.shots') AS `shot`
		ON json_extract(`shot`.`value`, '$.shotId') = `selected_shot`.`value`
	WHERE `take`.`discarded_at` IS NULL
		AND NOT EXISTS (
			SELECT 1
			FROM `scene_shot_video_take_shot` AS `existing_take_shot`
			WHERE `existing_take_shot`.`take_id` = `take`.`id`
				AND `existing_take_shot`.`discarded_at` IS NULL
		)
),
`latest_storyboard_images` AS (
	SELECT
		`image`.`shot_list_id`,
		`image`.`shot_id`,
		`image`.`id`,
		`image`.`asset_file_id`,
		`image`.`shot_content_fingerprint`
	FROM `scene_shot_storyboard_image` AS `image`
	WHERE `image`.`discarded_at` IS NULL
		AND NOT EXISTS (
			SELECT 1
			FROM `scene_shot_storyboard_image` AS `newer_image`
			WHERE `newer_image`.`shot_list_id` = `image`.`shot_list_id`
				AND `newer_image`.`shot_id` = `image`.`shot_id`
				AND `newer_image`.`discarded_at` IS NULL
				AND (
					`newer_image`.`created_at` > `image`.`created_at`
					OR (
						`newer_image`.`created_at` = `image`.`created_at`
						AND `newer_image`.`id` > `image`.`id`
					)
				)
		)
)
SELECT
	`recovered`.`take_id`,
	`recovered`.`shot_id`,
	`recovered`.`shot_order`,
	json_object(
		'title',
		json_extract(`recovered`.`shot_json`, '$.title'),
		'storyBeat',
		json_extract(`recovered`.`shot_json`, '$.storyBeat'),
		'narrativePurpose',
		json_extract(`recovered`.`shot_json`, '$.narrativePurpose'),
		'description',
		json_extract(`recovered`.`shot_json`, '$.description'),
		'shotType',
		json_extract(`recovered`.`shot_json`, '$.shotType'),
		'cameraAngle',
		json_extract(`recovered`.`shot_json`, '$.cameraAngle'),
		'cameraMovement',
		json_extract(`recovered`.`shot_json`, '$.cameraMovement'),
		'framing',
		json_extract(`recovered`.`shot_json`, '$.framing'),
		'lensIntent',
		json_extract(`recovered`.`shot_json`, '$.lensIntent'),
		'aspectRatio',
		json_extract(`recovered`.`shot_json`, '$.aspectRatio'),
		'subject',
		json_extract(`recovered`.`shot_json`, '$.subject'),
		'action',
		json_extract(`recovered`.`shot_json`, '$.action'),
		'dialogue',
		json(COALESCE(json_extract(`recovered`.`shot_json`, '$.dialogue'), '[]')),
		'coveredBlockIndexes',
		json(COALESCE(json_extract(`recovered`.`shot_json`, '$.coveredBlockIndexes'), '[]')),
		'castMemberIds',
		json(COALESCE(json_extract(`recovered`.`shot_json`, '$.castMemberIds'), '[]')),
		'locationIds',
		json(COALESCE(json_extract(`recovered`.`shot_json`, '$.locationIds'), '[]')),
		'audioNotes',
		json_extract(`recovered`.`shot_json`, '$.audioNotes'),
		'productionNotes',
		json_extract(`recovered`.`shot_json`, '$.productionNotes')
	),
	`storyboard`.`id`,
	`storyboard`.`asset_file_id`,
	CASE
		WHEN `storyboard`.`id` IS NULL THEN 'null'
		ELSE json_object(
			'id',
			`storyboard`.`id`,
			'assetFileId',
			`storyboard`.`asset_file_id`,
			'shotContentFingerprint',
			`storyboard`.`shot_content_fingerprint`
		)
	END,
	NULL,
	NULL,
	NULL
FROM `recovered_take_shots` AS `recovered`
LEFT JOIN `latest_storyboard_images` AS `storyboard`
	ON `storyboard`.`shot_list_id` = `recovered`.`shot_list_id`
	AND `storyboard`.`shot_id` = `recovered`.`shot_id`;--> statement-breakpoint
UPDATE `asset`
SET
	`discarded_at` = NULL,
	`discard_operation_id` = NULL,
	`restored_at` = COALESCE(`asset`.`restored_at`, `asset`.`updated_at`)
WHERE `asset`.`id` IN (
	SELECT json_extract(`prepared_input`.`value`, '$.assetId')
	FROM `scene_shot_video_take` AS `take`
	INNER JOIN json_each(
		`take`.`state_json`,
		'$.production.preparedInputs'
	) AS `prepared_input`
	WHERE `take`.`discarded_at` IS NULL
		AND json_extract(`prepared_input`.`value`, '$.assetId') IS NOT NULL
);--> statement-breakpoint
UPDATE `asset_file`
SET
	`discarded_at` = NULL,
	`discard_operation_id` = NULL,
	`restored_at` = COALESCE(`asset_file`.`restored_at`, `asset_file`.`updated_at`)
WHERE `asset_file`.`id` IN (
	SELECT json_extract(`prepared_input`.`value`, '$.assetFileId')
	FROM `scene_shot_video_take` AS `take`
	INNER JOIN json_each(
		`take`.`state_json`,
		'$.production.preparedInputs'
	) AS `prepared_input`
	WHERE `take`.`discarded_at` IS NULL
		AND json_extract(`prepared_input`.`value`, '$.assetFileId') IS NOT NULL
);--> statement-breakpoint
INSERT OR IGNORE INTO `scene_shot_video_take_media_input` (
	`id`,
	`scene_id`,
	`take_id`,
	`input_kind`,
	`subject_kind`,
	`subject_id`,
	`asset_id`,
	`asset_file_id`,
	`media_generation_run_id`,
	`selection`,
	`created_at`,
	`updated_at`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
)
WITH `state_inputs` AS (
	SELECT
		`take`.`id` AS `take_id`,
		`take`.`scene_id`,
		CAST(`prepared_input`.`key` AS integer) AS `input_order`,
		json_extract(`prepared_input`.`value`, '$.kind') AS `input_kind`,
		json_extract(`prepared_input`.`value`, '$.subjectKind') AS `subject_kind`,
		json_extract(`prepared_input`.`value`, '$.subjectId') AS `subject_id`,
		json_extract(`prepared_input`.`value`, '$.assetId') AS `asset_id`,
		json_extract(`prepared_input`.`value`, '$.assetFileId') AS `asset_file_id`,
		`take`.`created_at` AS `take_created_at`,
		`take`.`updated_at` AS `take_updated_at`
	FROM `scene_shot_video_take` AS `take`
	INNER JOIN json_each(
		`take`.`state_json`,
		'$.production.preparedInputs'
	) AS `prepared_input`
	WHERE `take`.`discarded_at` IS NULL
),
`matched_runs` AS (
	SELECT
		`state_input`.`take_id`,
		`state_input`.`input_order`,
		`run`.`id` AS `media_generation_run_id`,
		ROW_NUMBER() OVER (
			PARTITION BY `state_input`.`take_id`, `state_input`.`input_order`
			ORDER BY
				COALESCE(`run`.`completed_at`, `run`.`started_at`) DESC,
				`run`.`id` DESC
		) AS `run_rank`
	FROM `state_inputs` AS `state_input`
	INNER JOIN `asset_file` AS `file`
		ON `file`.`id` = `state_input`.`asset_file_id`
	INNER JOIN `media_generation_run` AS `run`
		ON `run`.`target_id` = `state_input`.`take_id`
	INNER JOIN json_each(`run`.`outputs_json`) AS `output`
		ON json_extract(`output`.`value`, '$.projectRelativePath') =
			`file`.`project_relative_path`
)
SELECT
	'scene_shot_video_take_media_input_recovered_' ||
		`state_input`.`take_id` || '_' ||
		`state_input`.`input_order`,
	`state_input`.`scene_id`,
	`state_input`.`take_id`,
	`state_input`.`input_kind`,
	`state_input`.`subject_kind`,
	`state_input`.`subject_id`,
	`state_input`.`asset_id`,
	`state_input`.`asset_file_id`,
	`matched_run`.`media_generation_run_id`,
	'select',
	`state_input`.`take_created_at`,
	`state_input`.`take_updated_at`,
	NULL,
	NULL,
	NULL
FROM `state_inputs` AS `state_input`
INNER JOIN `asset` AS `asset`
	ON `asset`.`id` = `state_input`.`asset_id`
	AND `asset`.`discarded_at` IS NULL
INNER JOIN `asset_file` AS `file`
	ON `file`.`id` = `state_input`.`asset_file_id`
	AND `file`.`asset_id` = `asset`.`id`
	AND `file`.`discarded_at` IS NULL
LEFT JOIN `matched_runs` AS `matched_run`
	ON `matched_run`.`take_id` = `state_input`.`take_id`
	AND `matched_run`.`input_order` = `state_input`.`input_order`
	AND `matched_run`.`run_rank` = 1
WHERE `state_input`.`input_kind` IS NOT NULL
	AND `state_input`.`subject_kind` IS NOT NULL
	AND `state_input`.`subject_id` IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM `scene_shot_video_take_media_input` AS `existing_input`
		WHERE `existing_input`.`scene_id` = `state_input`.`scene_id`
			AND `existing_input`.`take_id` = `state_input`.`take_id`
			AND `existing_input`.`input_kind` = `state_input`.`input_kind`
			AND `existing_input`.`subject_kind` = `state_input`.`subject_kind`
			AND `existing_input`.`subject_id` = `state_input`.`subject_id`
			AND `existing_input`.`selection` = 'select'
			AND `existing_input`.`discarded_at` IS NULL
	);--> statement-breakpoint
INSERT OR IGNORE INTO `scene_shot_video_take_media_input_shot` (
	`input_id`,
	`shot_id`,
	`shot_order`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
)
SELECT
	`input`.`id`,
	`take_shot`.`shot_id`,
	`take_shot`.`shot_order`,
	NULL,
	NULL,
	NULL
FROM `scene_shot_video_take_media_input` AS `input`
INNER JOIN `scene_shot_video_take_shot` AS `take_shot`
	ON `take_shot`.`take_id` = `input`.`take_id`
	AND `take_shot`.`discarded_at` IS NULL
WHERE `input`.`discarded_at` IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM `scene_shot_video_take_media_input_shot` AS `existing_input_shot`
		WHERE `existing_input_shot`.`input_id` = `input`.`id`
			AND `existing_input_shot`.`shot_id` = `take_shot`.`shot_id`
	);--> statement-breakpoint
INSERT OR IGNORE INTO `scene_shot_video_take_video` (
	`take_id`,
	`asset_id`,
	`asset_file_id`,
	`media_generation_run_id`,
	`created_at`,
	`updated_at`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
)
WITH `run_outputs` AS (
	SELECT
		`run`.`id` AS `run_id`,
		`run`.`target_id` AS `take_id`,
		COALESCE(`run`.`completed_at`, `run`.`started_at`) AS `run_completed_at`,
		json_extract(`output`.`value`, '$.projectRelativePath') AS `project_relative_path`
	FROM `media_generation_run` AS `run`
	INNER JOIN json_each(`run`.`outputs_json`) AS `output`
	WHERE `run`.`purpose` = 'shot.video-take'
		AND `run`.`target_kind` = 'sceneShotVideoTake'
		AND `run`.`status` = 'completed'
		AND json_extract(`output`.`value`, '$.projectRelativePath') IS NOT NULL
),
`matched_videos` AS (
	SELECT
		`run_output`.`take_id`,
		`asset`.`id` AS `asset_id`,
		`file`.`id` AS `asset_file_id`,
		`run_output`.`run_id`,
		COALESCE(`file`.`created_at`, `run_output`.`run_completed_at`) AS `created_at`,
		COALESCE(`file`.`updated_at`, `run_output`.`run_completed_at`) AS `updated_at`,
		ROW_NUMBER() OVER (
			PARTITION BY `run_output`.`take_id`
			ORDER BY
				`run_output`.`run_completed_at` DESC,
				`run_output`.`run_id` DESC
		) AS `video_rank`
	FROM `run_outputs` AS `run_output`
	INNER JOIN `scene_shot_video_take` AS `take`
		ON `take`.`id` = `run_output`.`take_id`
		AND `take`.`discarded_at` IS NULL
	INNER JOIN `asset_file` AS `file`
		ON `file`.`project_relative_path` = `run_output`.`project_relative_path`
		AND `file`.`media_kind` = 'video'
		AND `file`.`discarded_at` IS NULL
	INNER JOIN `asset` AS `asset`
		ON `asset`.`id` = `file`.`asset_id`
		AND `asset`.`media_kind` = 'video'
		AND `asset`.`discarded_at` IS NULL
)
SELECT
	`matched`.`take_id`,
	`matched`.`asset_id`,
	`matched`.`asset_file_id`,
	`matched`.`run_id`,
	`matched`.`created_at`,
	`matched`.`updated_at`,
	NULL,
	NULL,
	NULL
FROM `matched_videos` AS `matched`
WHERE `matched`.`video_rank` = 1
	AND NOT EXISTS (
		SELECT 1
		FROM `scene_shot_video_take_video` AS `existing_video`
		WHERE `existing_video`.`take_id` = `matched`.`take_id`
			AND `existing_video`.`discarded_at` IS NULL
	);
