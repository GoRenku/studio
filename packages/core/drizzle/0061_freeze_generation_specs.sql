ALTER TABLE `media_generation_spec` ADD `frozen_at` text;--> statement-breakpoint
UPDATE `media_generation_spec`
SET `frozen_at` = (
	SELECT min(`evidence`.`occurred_at`)
	FROM (
		SELECT `run`.`started_at` AS `occurred_at`
		FROM `media_generation_run` AS `run`
		WHERE `run`.`spec_id` = `media_generation_spec`.`id`
			AND `run`.`status` <> 'simulated'
		UNION ALL
		SELECT `provenance`.`created_at` AS `occurred_at`
		FROM `asset_file_generation` AS `provenance`
		INNER JOIN `media_generation_run` AS `run`
			ON `run`.`id` = `provenance`.`media_generation_run_id`
		WHERE `run`.`spec_id` = `media_generation_spec`.`id`
		UNION ALL
		SELECT `file`.`created_at` AS `occurred_at`
		FROM `asset_file` AS `file`
		WHERE `file`.`source_generation_spec_id` = `media_generation_spec`.`id`
	) AS `evidence`
)
WHERE EXISTS (
	SELECT 1
	FROM `media_generation_run` AS `run`
	WHERE `run`.`spec_id` = `media_generation_spec`.`id`
		AND `run`.`status` <> 'simulated'
)
OR EXISTS (
	SELECT 1
	FROM `asset_file_generation` AS `provenance`
	INNER JOIN `media_generation_run` AS `run`
		ON `run`.`id` = `provenance`.`media_generation_run_id`
	WHERE `run`.`spec_id` = `media_generation_spec`.`id`
)
OR EXISTS (
	SELECT 1
	FROM `asset_file` AS `file`
	WHERE `file`.`source_generation_spec_id` = `media_generation_spec`.`id`
);--> statement-breakpoint
PRAGMA user_version = 48;
