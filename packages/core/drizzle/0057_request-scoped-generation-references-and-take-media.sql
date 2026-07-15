-- Fail before schema changes unless each duplicate Take spec group is the exact
-- two-row legacy shape: one authored spec plus one reference-only recovery spec,
-- with any overlapping placements pointing at the same exact reference.
CREATE TABLE `_migration_0057_take_spec_preflight` (
	`ok` integer NOT NULL CHECK (`ok` = 1)
);
--> statement-breakpoint
INSERT INTO `_migration_0057_take_spec_preflight` (`ok`)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM `media_generation_spec` AS `group_spec`
	WHERE `group_spec`.`purpose` = 'shot.video-take'
		AND `group_spec`.`target_kind` = 'sceneShotVideoTake'
	GROUP BY `group_spec`.`target_id`
	HAVING count(*) > 1 AND (
		count(*) <> 2
		OR sum(CASE WHEN `group_spec`.`provider` IS NULL AND `group_spec`.`values_json` = '{}' THEN 1 ELSE 0 END) <> 1
		OR sum(CASE WHEN `group_spec`.`provider` IS NOT NULL THEN 1 ELSE 0 END) <> 1
		OR EXISTS (
			SELECT 1
			FROM `media_generation_spec` AS `recovery`, json_each(`recovery`.`references_json`) AS `recovery_reference`
			JOIN `media_generation_spec` AS `authored`
				ON `authored`.`target_id` = `recovery`.`target_id`
				AND `authored`.`purpose` = 'shot.video-take'
				AND `authored`.`target_kind` = 'sceneShotVideoTake'
				AND `authored`.`provider` IS NOT NULL
			JOIN json_each(`authored`.`references_json`) AS `authored_reference`
				ON json_extract(`authored_reference`.`value`, '$.placement.sectionId') = json_extract(`recovery_reference`.`value`, '$.placement.sectionId')
				AND json_extract(`authored_reference`.`value`, '$.placement.slotId') = json_extract(`recovery_reference`.`value`, '$.placement.slotId')
				AND coalesce(json_extract(`authored_reference`.`value`, '$.placement.scope.kind'), '') = coalesce(json_extract(`recovery_reference`.`value`, '$.placement.scope.kind'), '')
				AND coalesce(json_extract(`authored_reference`.`value`, '$.placement.scope.id'), '') = coalesce(json_extract(`recovery_reference`.`value`, '$.placement.scope.id'), '')
				AND coalesce(json_extract(`authored_reference`.`value`, '$.placement.subject.kind'), '') = coalesce(json_extract(`recovery_reference`.`value`, '$.placement.subject.kind'), '')
				AND coalesce(json_extract(`authored_reference`.`value`, '$.placement.subject.id'), '') = coalesce(json_extract(`recovery_reference`.`value`, '$.placement.subject.id'), '')
			WHERE `recovery`.`target_id` = `group_spec`.`target_id`
				AND `recovery`.`purpose` = 'shot.video-take'
				AND `recovery`.`target_kind` = 'sceneShotVideoTake'
				AND `recovery`.`provider` IS NULL
				AND (
					json_extract(`authored_reference`.`value`, '$.reference.kind') <> json_extract(`recovery_reference`.`value`, '$.reference.kind')
					OR coalesce(json_extract(`authored_reference`.`value`, '$.reference.assetId'), '') <> coalesce(json_extract(`recovery_reference`.`value`, '$.reference.assetId'), '')
					OR coalesce(json_extract(`authored_reference`.`value`, '$.reference.assetFileId'), '') <> coalesce(json_extract(`recovery_reference`.`value`, '$.reference.assetFileId'), '')
					OR coalesce(json_extract(`authored_reference`.`value`, '$.reference.projectRelativePath'), '') <> coalesce(json_extract(`recovery_reference`.`value`, '$.reference.projectRelativePath'), '')
				)
		)
	)
) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE `_migration_0057_take_spec_preflight`;
--> statement-breakpoint
-- Merge only the exact recovery shape accepted above. Authored rows retain
-- their prompt/model values; non-overlapping exact reference envelopes append.
UPDATE `media_generation_spec` AS `authored`
SET `references_json` = (
	SELECT json_group_array(json(`merged_reference`.`value`))
	FROM (
		SELECT `authored_reference`.`key` AS `sort_key`, `authored_reference`.`value` AS `value`
		FROM json_each(`authored`.`references_json`) AS `authored_reference`
		UNION ALL
		SELECT 100000 + `recovery_reference`.`key` AS `sort_key`, `recovery_reference`.`value` AS `value`
		FROM `media_generation_spec` AS `recovery`, json_each(`recovery`.`references_json`) AS `recovery_reference`
		WHERE `recovery`.`target_id` = `authored`.`target_id`
			AND `recovery`.`purpose` = 'shot.video-take'
			AND `recovery`.`target_kind` = 'sceneShotVideoTake'
			AND `recovery`.`provider` IS NULL
			AND `recovery`.`values_json` = '{}'
			AND NOT EXISTS (
				SELECT 1 FROM json_each(`authored`.`references_json`) AS `existing_reference`
				WHERE json_extract(`existing_reference`.`value`, '$.placement.sectionId') = json_extract(`recovery_reference`.`value`, '$.placement.sectionId')
					AND json_extract(`existing_reference`.`value`, '$.placement.slotId') = json_extract(`recovery_reference`.`value`, '$.placement.slotId')
					AND coalesce(json_extract(`existing_reference`.`value`, '$.placement.scope.kind'), '') = coalesce(json_extract(`recovery_reference`.`value`, '$.placement.scope.kind'), '')
					AND coalesce(json_extract(`existing_reference`.`value`, '$.placement.scope.id'), '') = coalesce(json_extract(`recovery_reference`.`value`, '$.placement.scope.id'), '')
					AND coalesce(json_extract(`existing_reference`.`value`, '$.placement.subject.kind'), '') = coalesce(json_extract(`recovery_reference`.`value`, '$.placement.subject.kind'), '')
					AND coalesce(json_extract(`existing_reference`.`value`, '$.placement.subject.id'), '') = coalesce(json_extract(`recovery_reference`.`value`, '$.placement.subject.id'), '')
			)
		ORDER BY `sort_key`
	) AS `merged_reference`
)
WHERE `authored`.`purpose` = 'shot.video-take'
	AND `authored`.`target_kind` = 'sceneShotVideoTake'
	AND `authored`.`provider` IS NOT NULL
	AND EXISTS (
		SELECT 1 FROM `media_generation_spec` AS `recovery`
		WHERE `recovery`.`target_id` = `authored`.`target_id`
			AND `recovery`.`purpose` = 'shot.video-take'
			AND `recovery`.`target_kind` = 'sceneShotVideoTake'
			AND `recovery`.`provider` IS NULL
			AND `recovery`.`values_json` = '{}'
	);
--> statement-breakpoint
DELETE FROM `media_generation_spec`
WHERE `purpose` = 'shot.video-take'
	AND `target_kind` = 'sceneShotVideoTake'
	AND `provider` IS NULL
	AND `values_json` = '{}'
	AND EXISTS (
		SELECT 1 FROM `media_generation_spec` AS `authored`
		WHERE `authored`.`target_id` = `media_generation_spec`.`target_id`
			AND `authored`.`purpose` = 'shot.video-take'
			AND `authored`.`target_kind` = 'sceneShotVideoTake'
			AND `authored`.`provider` IS NOT NULL
	);
--> statement-breakpoint
CREATE TABLE `scene_shot_video_take_image` (
	`take_id` text NOT NULL,
	`role` text NOT NULL,
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
CREATE UNIQUE INDEX `scene_shot_video_take_image_role_idx` ON `scene_shot_video_take_image` (`take_id`,`role`);--> statement-breakpoint
CREATE INDEX `scene_shot_video_take_image_asset_idx` ON `scene_shot_video_take_image` (`asset_id`);--> statement-breakpoint
CREATE TABLE `cast_profile_display_asset` (
	`cast_member_id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `location_hero_display_asset` (
	`location_id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- This custom data step is required by ADR 0049. It preserves only an explicit
-- profile/hero display choice and never chooses an arbitrary first asset.
INSERT INTO `cast_profile_display_asset` (`cast_member_id`, `asset_id`, `created_at`, `updated_at`)
SELECT `cast_member_id`, `asset_id`, `updated_at`, `updated_at`
FROM (
	SELECT *, row_number() OVER (
		PARTITION BY `cast_member_id`
		ORDER BY `selection_order`, `sort_order`, `asset_id`
	) AS `display_rank`
	FROM `cast_asset`
	WHERE `role` = 'profile' AND `selection` = 'select' AND `discarded_at` IS NULL
)
WHERE `display_rank` = 1;
--> statement-breakpoint
INSERT INTO `location_hero_display_asset` (`location_id`, `asset_id`, `created_at`, `updated_at`)
SELECT `location_id`, `asset_id`, `updated_at`, `updated_at`
FROM (
	SELECT *, row_number() OVER (
		PARTITION BY `location_id`
		ORDER BY `selection_order`, `sort_order`, `asset_id`
	) AS `display_rank`
	FROM `location_asset`
	WHERE `role` = 'hero' AND `selection` = 'select' AND `discarded_at` IS NULL
)
WHERE `display_rank` = 1;
--> statement-breakpoint
-- Rename only the owned slot envelope. Prompt text and arbitrary JSON values
-- remain opaque and untouched.
UPDATE `media_generation_spec`
SET `references_json` = (
	SELECT json_group_array(json(
		CASE
			WHEN json_extract(`reference`.`value`, '$.placement.slotId') = 'video-prompt-sheet'
			THEN json_set(`reference`.`value`, '$.placement.slotId', 'video-prompt')
			ELSE `reference`.`value`
		END
	))
	FROM json_each(`media_generation_spec`.`references_json`) AS `reference`
)
WHERE `references_json` LIKE '%"slotId":"video-prompt-sheet"%';
--> statement-breakpoint
DROP INDEX `cast_asset_filter_order_idx`;--> statement-breakpoint
CREATE INDEX `cast_asset_filter_order_idx` ON `cast_asset` (`cast_member_id`,`role`,`sort_order`,`asset_id`);--> statement-breakpoint
ALTER TABLE `cast_asset` DROP COLUMN `selection`;--> statement-breakpoint
ALTER TABLE `cast_asset` DROP COLUMN `selection_order`;--> statement-breakpoint
DROP INDEX `location_asset_filter_order_idx`;--> statement-breakpoint
CREATE INDEX `location_asset_filter_order_idx` ON `location_asset` (`location_id`,`role`,`sort_order`,`asset_id`);--> statement-breakpoint
ALTER TABLE `location_asset` DROP COLUMN `selection`;--> statement-breakpoint
ALTER TABLE `location_asset` DROP COLUMN `selection_order`;--> statement-breakpoint
DROP INDEX `project_asset_filter_order_idx`;--> statement-breakpoint
CREATE INDEX `project_asset_filter_order_idx` ON `project_asset` (`role`,`sort_order`,`asset_id`);--> statement-breakpoint
ALTER TABLE `project_asset` DROP COLUMN `selection`;--> statement-breakpoint
ALTER TABLE `project_asset` DROP COLUMN `selection_order`;--> statement-breakpoint
DROP INDEX `scene_asset_filter_order_idx`;--> statement-breakpoint
CREATE INDEX `scene_asset_filter_order_idx` ON `scene_asset` (`scene_id`,`role`,`sort_order`,`asset_id`);--> statement-breakpoint
ALTER TABLE `scene_asset` DROP COLUMN `selection`;--> statement-breakpoint
ALTER TABLE `scene_asset` DROP COLUMN `selection_order`;--> statement-breakpoint
DROP INDEX `sequence_asset_filter_order_idx`;--> statement-breakpoint
CREATE INDEX `sequence_asset_filter_order_idx` ON `sequence_asset` (`sequence_id`,`role`,`sort_order`,`asset_id`);--> statement-breakpoint
ALTER TABLE `sequence_asset` DROP COLUMN `selection`;--> statement-breakpoint
ALTER TABLE `sequence_asset` DROP COLUMN `selection_order`;--> statement-breakpoint
CREATE UNIQUE INDEX `media_generation_spec_take_purpose_idx` ON `media_generation_spec` (`purpose`,`target_kind`,`target_id`) WHERE "media_generation_spec"."target_kind" = 'sceneShotVideoTake' and "media_generation_spec"."purpose" in ('shot.first-frame', 'shot.last-frame', 'shot.video-prompt', 'shot.video-take');
