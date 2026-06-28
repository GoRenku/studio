PRAGMA user_version = 31;--> statement-breakpoint
-- Repair project databases migrated by the first 0040 draft, where rebuilding
-- scene_shot_video_take could cascade-delete take-owned shot membership rows.
-- The take history snapshot is the durable source for the selected shot ids.
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
	WHERE NOT EXISTS (
		SELECT 1
		FROM `scene_shot_video_take_shot` AS `existing_take_shot`
		WHERE `existing_take_shot`.`take_id` = `take`.`id`
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
	WHERE NOT EXISTS (
		SELECT 1
		FROM `scene_shot_storyboard_image` AS `newer_image`
		WHERE `newer_image`.`shot_list_id` = `image`.`shot_list_id`
			AND `newer_image`.`shot_id` = `image`.`shot_id`
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
	AND `storyboard`.`shot_id` = `recovered`.`shot_id`;
