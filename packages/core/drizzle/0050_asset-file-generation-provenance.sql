PRAGMA user_version = 40;--> statement-breakpoint
CREATE TABLE `asset_file_generation` (
	`asset_file_id` text PRIMARY KEY NOT NULL,
	`media_generation_run_id` text NOT NULL,
	`output_artifact_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_generation_run_id`) REFERENCES `media_generation_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `asset_file_generation_run_idx` ON `asset_file_generation` (`media_generation_run_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `asset_file_generation` (
	`asset_file_id`,
	`media_generation_run_id`,
	`output_artifact_id`,
	`created_at`
)
SELECT
	`owner`.`asset_file_id`,
	`owner`.`media_generation_run_id`,
	(
		SELECT json_extract(`output`.`value`, '$.artifactId')
		FROM json_each(`run`.`outputs_json`) AS `output`
		WHERE json_extract(`output`.`value`, '$.contentHash') = `file`.`content_hash`
		LIMIT 1
	),
	coalesce(`run`.`completed_at`, `run`.`started_at`, `file`.`created_at`)
FROM (
	SELECT `asset_file_id`, `media_generation_run_id`
	FROM `scene_dialogue_audio_take`
	UNION ALL
	SELECT `asset_file_id`, `media_generation_run_id`
	FROM `scene_shot_video_take_media_input`
	WHERE `media_generation_run_id` IS NOT NULL
	UNION ALL
	SELECT `asset_file_id`, `media_generation_run_id`
	FROM `scene_shot_video_take_video`
	WHERE `media_generation_run_id` IS NOT NULL
) AS `owner`
INNER JOIN `asset_file` AS `file`
	ON `file`.`id` = `owner`.`asset_file_id`
INNER JOIN `media_generation_run` AS `run`
	ON `run`.`id` = `owner`.`media_generation_run_id`
WHERE `run`.`status` = 'completed';
--> statement-breakpoint
WITH `generation_output_candidate` AS (
	SELECT
		`file`.`id` AS `asset_file_id`,
		`run`.`id` AS `media_generation_run_id`,
		json_extract(`output`.`value`, '$.artifactId') AS `output_artifact_id`,
		coalesce(`run`.`completed_at`, `run`.`started_at`, `file`.`created_at`) AS `created_at`
	FROM `asset_file` AS `file`
	INNER JOIN `media_generation_run` AS `run`
		ON `run`.`status` = 'completed'
	INNER JOIN json_each(`run`.`outputs_json`) AS `output`
	WHERE `file`.`discarded_at` IS NULL
		AND `file`.`media_kind` = 'image'
		AND `file`.`content_hash` IS NOT NULL
		AND replace(json_extract(`output`.`value`, '$.contentHash'), 'sha256:', '') = replace(`file`.`content_hash`, 'sha256:', '')
		AND (
			json_extract(`output`.`value`, '$.mimeType') IS NULL
			OR json_extract(`output`.`value`, '$.mimeType') LIKE 'image/%'
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
FROM `unique_generation_output`;
