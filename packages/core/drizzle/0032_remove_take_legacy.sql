PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TEMP TABLE `_scene_shot_video_take_id_rewrite` (
	`old_id` text PRIMARY KEY NOT NULL,
	`new_id` text NOT NULL UNIQUE
);--> statement-breakpoint
INSERT INTO `_scene_shot_video_take_id_rewrite` (`old_id`, `new_id`)
SELECT
	`id`,
	REPLACE(`id`, 'scene_shot_video_take_generation_', 'scene_shot_video_take_')
FROM `scene_shot_video_take`
WHERE `id` LIKE 'scene_shot_video_take_generation_%';--> statement-breakpoint
INSERT INTO `_scene_shot_video_take_id_rewrite` (`old_id`, `new_id`)
SELECT
	'collision:' || `rewrite`.`old_id`,
	`rewrite`.`new_id`
FROM `_scene_shot_video_take_id_rewrite` `rewrite`
WHERE EXISTS (
	SELECT 1
	FROM `scene_shot_video_take` `existing`
	WHERE `existing`.`id` = `rewrite`.`new_id`
		AND `existing`.`id` <> `rewrite`.`old_id`
);--> statement-breakpoint
UPDATE `scene_shot_video_take_shot`
SET `take_id` = (
	SELECT `new_id`
	FROM `_scene_shot_video_take_id_rewrite`
	WHERE `old_id` = `scene_shot_video_take_shot`.`take_id`
)
WHERE `take_id` IN (
	SELECT `old_id`
	FROM `_scene_shot_video_take_id_rewrite`
);--> statement-breakpoint
UPDATE `scene_shot_video_take_media_input`
SET `take_id` = (
	SELECT `new_id`
	FROM `_scene_shot_video_take_id_rewrite`
	WHERE `old_id` = `scene_shot_video_take_media_input`.`take_id`
)
WHERE `take_id` IN (
	SELECT `old_id`
	FROM `_scene_shot_video_take_id_rewrite`
);--> statement-breakpoint
UPDATE `scene_shot_video_take_output`
SET `take_id` = (
	SELECT `new_id`
	FROM `_scene_shot_video_take_id_rewrite`
	WHERE `old_id` = `scene_shot_video_take_output`.`take_id`
)
WHERE `take_id` IN (
	SELECT `old_id`
	FROM `_scene_shot_video_take_id_rewrite`
);--> statement-breakpoint
UPDATE `scene_shot_video_take`
SET `id` = (
	SELECT `new_id`
	FROM `_scene_shot_video_take_id_rewrite`
	WHERE `old_id` = `scene_shot_video_take`.`id`
)
WHERE `id` IN (
	SELECT `old_id`
	FROM `_scene_shot_video_take_id_rewrite`
);--> statement-breakpoint
UPDATE `media_generation_spec`
SET
	`target_id` = (
		SELECT `new_id`
		FROM `_scene_shot_video_take_id_rewrite`
		WHERE `old_id` = `media_generation_spec`.`target_id`
	),
	`spec_json` = REPLACE(`spec_json`, 'scene_shot_video_take_generation_', 'scene_shot_video_take_')
WHERE `target_kind` = 'sceneShotVideoTake'
	AND `target_id` IN (
		SELECT `old_id`
		FROM `_scene_shot_video_take_id_rewrite`
	);--> statement-breakpoint
UPDATE `media_generation_run`
SET
	`target_id` = (
		SELECT `new_id`
		FROM `_scene_shot_video_take_id_rewrite`
		WHERE `old_id` = `media_generation_run`.`target_id`
	),
	`spec_snapshot_json` = REPLACE(`spec_snapshot_json`, 'scene_shot_video_take_generation_', 'scene_shot_video_take_'),
	`provider_payload_json` = REPLACE(`provider_payload_json`, 'scene_shot_video_take_generation_', 'scene_shot_video_take_'),
	`outputs_json` = REPLACE(`outputs_json`, 'scene_shot_video_take_generation_', 'scene_shot_video_take_'),
	`diagnostics_json` = REPLACE(`diagnostics_json`, 'scene_shot_video_take_generation_', 'scene_shot_video_take_')
WHERE `target_kind` = 'sceneShotVideoTake'
	AND `target_id` IN (
		SELECT `old_id`
		FROM `_scene_shot_video_take_id_rewrite`
	);--> statement-breakpoint
DROP TABLE `_scene_shot_video_take_id_rewrite`;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take` RENAME COLUMN `shot_list_id` TO `source_shot_list_id`;--> statement-breakpoint
ALTER TABLE `scene_shot_video_take` DROP COLUMN `production_json`;--> statement-breakpoint
PRAGMA user_version = 23;
