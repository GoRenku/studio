CREATE TABLE `asset_membership` (
	`asset_id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `asset_membership_owner_idx` ON `asset_membership` (`owner_key`,`asset_id`);--> statement-breakpoint
CREATE TABLE `selected_asset` (
	`owner_key` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `asset` ADD `locale_id` text REFERENCES project_locale(id);--> statement-breakpoint
ALTER TABLE `asset` ADD `reference_name` text;--> statement-breakpoint
ALTER TABLE `asset` ADD `purpose` text;--> statement-breakpoint

-- Custom preservation section: Drizzle Kit cannot infer the one-way conversion
-- from aggregate relationships and focused selections into exclusive membership.
CREATE TEMP TABLE `__asset_ownership_source` (
	`asset_id` text NOT NULL,
	`owner_key` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
INSERT INTO `__asset_ownership_source`
SELECT `asset_id`, 'project', `created_at`, `updated_at`
FROM `project_asset`;--> statement-breakpoint
INSERT INTO `__asset_ownership_source`
SELECT `asset_id`, 'castMember:' || `cast_member_id`, `created_at`, `updated_at`
FROM `cast_asset`;--> statement-breakpoint
INSERT INTO `__asset_ownership_source`
SELECT `asset_id`, 'location:' || `location_id`, `created_at`, `updated_at`
FROM `location_asset`;--> statement-breakpoint
INSERT INTO `__asset_ownership_source`
SELECT `asset_id`, 'sequence:' || `sequence_id`, `created_at`, `updated_at`
FROM `sequence_asset`;--> statement-breakpoint
INSERT INTO `__asset_ownership_source`
SELECT `asset_id`, 'shot:' || `shot_id`, `created_at`, `updated_at`
FROM `shot_asset`;--> statement-breakpoint
INSERT INTO `__asset_ownership_source`
SELECT `asset_id`, 'scene:' || `scene_id`, `created_at`, `updated_at`
FROM `scene_asset`
WHERE NOT EXISTS (
	SELECT 1
	FROM `scene_beat_storyboard_image`
	WHERE `scene_beat_storyboard_image`.`asset_id` = `scene_asset`.`asset_id`
);--> statement-breakpoint
INSERT INTO `__asset_ownership_source`
SELECT `asset_id`, 'lookbook:' || `lookbook_id`, `created_at`, `updated_at`
FROM `lookbook_image`;--> statement-breakpoint
INSERT INTO `__asset_ownership_source`
SELECT `asset_id`, 'lookbook:' || `lookbook_id`, `created_at`, `updated_at`
FROM `lookbook_sheet`;--> statement-breakpoint
INSERT INTO `__asset_ownership_source`
SELECT
	`storyboard_asset`.`asset_id`,
	'sceneBeat:' || `storyboard_asset`.`scene_id` || ':' || `storyboard_asset`.`beat_id`,
	(
		SELECT `first_storyboard_row`.`created_at`
		FROM `scene_beat_storyboard_image` `first_storyboard_row`
		WHERE `first_storyboard_row`.`asset_id` = `storyboard_asset`.`asset_id`
		ORDER BY
			(`first_storyboard_row`.`discarded_at` IS NULL) DESC,
			`first_storyboard_row`.`created_at`,
			`first_storyboard_row`.`id`
		LIMIT 1
	),
	(
		SELECT `first_storyboard_row`.`updated_at`
		FROM `scene_beat_storyboard_image` `first_storyboard_row`
		WHERE `first_storyboard_row`.`asset_id` = `storyboard_asset`.`asset_id`
		ORDER BY
			(`first_storyboard_row`.`discarded_at` IS NULL) DESC,
			`first_storyboard_row`.`created_at`,
			`first_storyboard_row`.`id`
		LIMIT 1
	)
FROM (
	SELECT DISTINCT `asset_id`, `scene_id`, `beat_id`
	FROM `scene_beat_storyboard_image`
) `storyboard_asset`;--> statement-breakpoint

CREATE TEMP TABLE `__asset_ownership_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `__asset_ownership_guard`
SELECT CASE WHEN NOT EXISTS (
	SELECT 1
	FROM (
		SELECT `cast_member_id` AS `owner_id` FROM `cast_asset`
		UNION ALL SELECT `location_id` FROM `location_asset`
		UNION ALL SELECT `sequence_id` FROM `sequence_asset`
		UNION ALL SELECT `scene_id` FROM `scene_asset`
		UNION ALL SELECT `shot_id` FROM `shot_asset`
		UNION ALL SELECT `lookbook_id` FROM `lookbook_image`
		UNION ALL SELECT `lookbook_id` FROM `lookbook_sheet`
		UNION ALL SELECT `scene_id` FROM `scene_beat_storyboard_image`
		UNION ALL SELECT `beat_id` FROM `scene_beat_storyboard_image`
	)
	WHERE `owner_id` = ''
		OR `owner_id` GLOB '*[^A-Za-z0-9._~!()*''-]*'
) THEN 1 ELSE 0 END;--> statement-breakpoint
DELETE FROM `__asset_ownership_guard`;--> statement-breakpoint
INSERT INTO `__asset_ownership_guard`
SELECT CASE WHEN NOT EXISTS (
	SELECT 1
	FROM `scene_beat_storyboard_image` `left_row`
	INNER JOIN `scene_beat_storyboard_image` `right_row`
		ON `right_row`.`asset_id` = `left_row`.`asset_id`
	WHERE `right_row`.`scene_id` IS NOT `left_row`.`scene_id`
		OR `right_row`.`beat_id` IS NOT `left_row`.`beat_id`
) THEN 1 ELSE 0 END;--> statement-breakpoint
DELETE FROM `__asset_ownership_guard`;--> statement-breakpoint
INSERT INTO `__asset_ownership_guard`
SELECT CASE WHEN
	(SELECT COUNT(*) FROM `__asset_ownership_source`) = (SELECT COUNT(*) FROM `asset`)
	AND NOT EXISTS (
		SELECT 1
		FROM `asset`
		LEFT JOIN `__asset_ownership_source`
			ON `__asset_ownership_source`.`asset_id` = `asset`.`id`
		GROUP BY `asset`.`id`
		HAVING COUNT(`__asset_ownership_source`.`asset_id`) <> 1
	)
	AND NOT EXISTS (
		SELECT 1
		FROM `__asset_ownership_source`
		LEFT JOIN `asset` ON `asset`.`id` = `__asset_ownership_source`.`asset_id`
		WHERE `asset`.`id` IS NULL
	)
THEN 1 ELSE 0 END;--> statement-breakpoint
DELETE FROM `__asset_ownership_guard`;--> statement-breakpoint
INSERT INTO `__asset_ownership_guard`
SELECT CASE WHEN NOT EXISTS (
	SELECT 1
	FROM (
		SELECT `asset_id`, `discarded_at`, `discard_operation_id`, `restored_at` FROM `project_asset`
		UNION ALL
		SELECT `asset_id`, `discarded_at`, `discard_operation_id`, `restored_at` FROM `cast_asset`
		UNION ALL
		SELECT `asset_id`, `discarded_at`, `discard_operation_id`, `restored_at` FROM `location_asset`
		UNION ALL
		SELECT `asset_id`, `discarded_at`, `discard_operation_id`, `restored_at` FROM `sequence_asset`
		UNION ALL
		SELECT `asset_id`, `discarded_at`, `discard_operation_id`, `restored_at` FROM `scene_asset`
		UNION ALL
		SELECT `asset_id`, `discarded_at`, `discard_operation_id`, `restored_at` FROM `shot_asset`
		UNION ALL
		SELECT `asset_id`, `discarded_at`, `discard_operation_id`, `restored_at` FROM `scene_beat_storyboard_image`
	) `relationship_lifecycle`
	INNER JOIN `asset` ON `asset`.`id` = `relationship_lifecycle`.`asset_id`
	WHERE `relationship_lifecycle`.`discarded_at` IS NOT `asset`.`discarded_at`
		OR `relationship_lifecycle`.`discard_operation_id` IS NOT `asset`.`discard_operation_id`
		OR `relationship_lifecycle`.`restored_at` IS NOT `asset`.`restored_at`
) THEN 1 ELSE 0 END;--> statement-breakpoint

CREATE TEMP TABLE `__asset_migration_inventory` AS
SELECT
	(SELECT COUNT(*) FROM `asset`) AS `asset_count`,
	(SELECT COUNT(*) FROM `asset_file`) AS `asset_file_count`,
	(SELECT COUNT(*) FROM `asset_file_generation`) AS `asset_file_generation_count`,
	(SELECT COUNT(*) FROM `lookbook_image`) AS `lookbook_image_count`,
	(SELECT COUNT(*) FROM `lookbook_sheet`) AS `lookbook_sheet_count`,
	(SELECT COUNT(*) FROM `lookbook_image_section`) AS `lookbook_image_section_count`,
	(SELECT COUNT(*) FROM `scene_dialogue_audio_take`) AS `dialogue_audio_take_count`,
	(SELECT COUNT(*) FROM `cast_voice`) AS `cast_voice_count`;--> statement-breakpoint

WITH `generic_asset_metadata` AS (
	SELECT `asset_id`, `locale_id`, `reference_name`, `purpose` FROM `project_asset`
	UNION ALL
	SELECT `asset_id`, `locale_id`, `reference_name`, `purpose` FROM `cast_asset`
	UNION ALL
	SELECT `asset_id`, `locale_id`, `reference_name`, `purpose` FROM `location_asset`
	UNION ALL
	SELECT `asset_id`, `locale_id`, `reference_name`, `purpose` FROM `sequence_asset`
	UNION ALL
	SELECT `asset_id`, `locale_id`, `reference_name`, `purpose` FROM `scene_asset`
	UNION ALL
	SELECT `asset_id`, `locale_id`, `reference_name`, `purpose` FROM `shot_asset`
)
UPDATE `asset`
SET
	`locale_id` = (
		SELECT `locale_id`
		FROM `generic_asset_metadata`
		WHERE `generic_asset_metadata`.`asset_id` = `asset`.`id`
	),
	`reference_name` = (
		SELECT `reference_name`
		FROM `generic_asset_metadata`
		WHERE `generic_asset_metadata`.`asset_id` = `asset`.`id`
	),
	`purpose` = (
		SELECT `purpose`
		FROM `generic_asset_metadata`
		WHERE `generic_asset_metadata`.`asset_id` = `asset`.`id`
	)
WHERE EXISTS (
	SELECT 1
	FROM `generic_asset_metadata`
	WHERE `generic_asset_metadata`.`asset_id` = `asset`.`id`
);--> statement-breakpoint
UPDATE `asset`
SET `type` = CASE
	WHEN `type` = 'generated-video' THEN 'project_video'
	WHEN `type` = 'lookbook-image' THEN 'lookbook_image'
	WHEN `type` IN ('video-lookbook-sheet', 'storyboard-lookbook-sheet') THEN 'lookbook_sheet'
	WHEN `type` = 'character-sheet' THEN 'character_sheet'
	WHEN `type` = 'profile' THEN 'cast_profile'
	WHEN `type` = 'location-sheet' THEN 'location_sheet'
	WHEN `type` = 'location-hero' THEN 'location_hero'
	WHEN `type` = 'shot-image' THEN 'shot_image'
	WHEN `type` = 'audio' AND EXISTS (
		SELECT 1
		FROM `scene_asset`
		WHERE `scene_asset`.`asset_id` = `asset`.`id`
			AND `scene_asset`.`role` = 'dialogue_audio'
	) THEN 'scene_dialogue_audio'
	ELSE `type`
END;--> statement-breakpoint
INSERT INTO `asset_membership` (`asset_id`, `owner_key`, `created_at`, `updated_at`)
SELECT `asset_id`, `owner_key`, `created_at`, `updated_at`
FROM `__asset_ownership_source`;--> statement-breakpoint

CREATE TEMP TABLE `__asset_selection_source` (
	`owner_key` text NOT NULL,
	`asset_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
INSERT INTO `__asset_selection_source`
SELECT
	'castMember:' || `cast_member_id`,
	`asset_id`,
	`created_at`,
	`updated_at`
FROM `cast_profile_display_asset`;--> statement-breakpoint
INSERT INTO `__asset_selection_source`
SELECT
	'location:' || `location_id`,
	`asset_id`,
	`created_at`,
	`updated_at`
FROM `location_hero_display_asset`;--> statement-breakpoint
INSERT INTO `__asset_selection_source`
SELECT
	'shot:' || `shot_id`,
	`asset_id`,
	`created_at`,
	`updated_at`
FROM `shot_representative_display_asset`;--> statement-breakpoint
INSERT INTO `__asset_selection_source`
SELECT
	'lookbook:' || `lookbook_card_image`.`lookbook_id`,
	`lookbook_image`.`asset_id`,
	`lookbook_card_image`.`created_at`,
	`lookbook_card_image`.`updated_at`
FROM `lookbook_card_image`
INNER JOIN `lookbook_image`
	ON `lookbook_image`.`id` = `lookbook_card_image`.`image_id`
WHERE `lookbook_card_image`.`discarded_at` IS NULL;--> statement-breakpoint
INSERT INTO `__asset_selection_source`
SELECT `owner_key`, `asset_id`, `created_at`, `updated_at`
FROM (
	SELECT
		'sceneBeat:' || `storyboard_image`.`scene_id` || ':' || `storyboard_image`.`beat_id` AS `owner_key`,
		`storyboard_image`.`asset_id`,
		`storyboard_image`.`created_at`,
		`storyboard_image`.`updated_at`,
		ROW_NUMBER() OVER (
			PARTITION BY `storyboard_image`.`scene_id`, `storyboard_image`.`beat_id`
			ORDER BY `storyboard_image`.`created_at` DESC, `storyboard_image`.`id` DESC
		) AS `selection_rank`
	FROM `scene_beat_storyboard_image` `storyboard_image`
	INNER JOIN `scene_beat_sheet_state` `beat_sheet_state`
		ON `beat_sheet_state`.`scene_id` = `storyboard_image`.`scene_id`
		AND `beat_sheet_state`.`active_beat_sheet_id` = `storyboard_image`.`beat_sheet_id`
	INNER JOIN `asset`
		ON `asset`.`id` = `storyboard_image`.`asset_id`
	WHERE `storyboard_image`.`discarded_at` IS NULL
		AND `asset`.`discarded_at` IS NULL
		AND `asset`.`availability` = 'ready'
)
WHERE `selection_rank` = 1;--> statement-breakpoint
DELETE FROM `__asset_ownership_guard`;--> statement-breakpoint
INSERT INTO `__asset_ownership_guard`
SELECT CASE WHEN
	NOT EXISTS (
		SELECT 1
		FROM `__asset_selection_source`
		GROUP BY `owner_key`
		HAVING COUNT(*) <> 1
	)
	AND NOT EXISTS (
		SELECT 1
		FROM `__asset_selection_source` `selection_source`
		LEFT JOIN `asset_membership`
			ON `asset_membership`.`asset_id` = `selection_source`.`asset_id`
		LEFT JOIN `asset`
			ON `asset`.`id` = `selection_source`.`asset_id`
		WHERE `asset_membership`.`owner_key` IS NOT `selection_source`.`owner_key`
			OR `asset`.`discarded_at` IS NOT NULL
			OR `asset`.`availability` <> 'ready'
			OR (
				`selection_source`.`owner_key` LIKE 'castMember:%'
				AND `asset`.`type` <> 'cast_profile'
			)
			OR (
				`selection_source`.`owner_key` LIKE 'location:%'
				AND `asset`.`type` <> 'location_hero'
			)
			OR (
				`selection_source`.`owner_key` LIKE 'lookbook:%'
				AND `asset`.`type` <> 'lookbook_image'
			)
			OR (
				`selection_source`.`owner_key` LIKE 'shot:%'
				AND `asset`.`type` <> 'shot_image'
			)
			OR (
				`selection_source`.`owner_key` LIKE 'sceneBeat:%'
				AND `asset`.`type` <> 'scene_storyboard_image'
			)
	)
THEN 1 ELSE 0 END;--> statement-breakpoint
INSERT INTO `selected_asset` (`owner_key`, `asset_id`, `created_at`, `updated_at`)
SELECT `owner_key`, `asset_id`, `created_at`, `updated_at`
FROM `__asset_selection_source`;--> statement-breakpoint

DELETE FROM `__asset_ownership_guard`;--> statement-breakpoint
INSERT INTO `__asset_ownership_guard`
SELECT CASE WHEN
	(SELECT COUNT(*) FROM `asset_membership`) = (SELECT `asset_count` FROM `__asset_migration_inventory`)
	AND (SELECT COUNT(*) FROM `selected_asset`) = (SELECT COUNT(*) FROM `__asset_selection_source`)
	AND NOT EXISTS (SELECT 1 FROM `pragma_foreign_key_check`)
	AND NOT EXISTS (
		SELECT 1
		FROM `pragma_quick_check`
		WHERE `quick_check` <> 'ok'
	)
THEN 1 ELSE 0 END;--> statement-breakpoint

DROP TABLE `cast_asset`;--> statement-breakpoint
DROP TABLE `location_asset`;--> statement-breakpoint
DROP TABLE `project_asset`;--> statement-breakpoint
DROP TABLE `scene_asset`;--> statement-breakpoint
DROP TABLE `sequence_asset`;--> statement-breakpoint
DROP TABLE `shot_representative_display_asset`;--> statement-breakpoint
DROP TABLE `shot_asset`;--> statement-breakpoint
DROP TABLE `scene_beat_storyboard_image`;--> statement-breakpoint
DROP TABLE `cast_profile_display_asset`;--> statement-breakpoint
DROP TABLE `location_hero_display_asset`;--> statement-breakpoint
DROP TABLE `lookbook_card_image`;--> statement-breakpoint

CREATE TEMP TABLE `__preserved_lookbook_image_section` AS
SELECT
	`id`,
	`image_id`,
	`section`,
	`sort_order`,
	`created_at`,
	`updated_at`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`,
	`point_id`
FROM `lookbook_image_section`;--> statement-breakpoint
DROP TABLE `lookbook_image_section`;--> statement-breakpoint
CREATE TABLE `__new_lookbook_image` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_lookbook_image`("id", "asset_id", "sort_order", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at")
SELECT "id", "asset_id", "sort_order", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at"
FROM `lookbook_image`;--> statement-breakpoint
DROP TABLE `lookbook_image`;--> statement-breakpoint
ALTER TABLE `__new_lookbook_image` RENAME TO `lookbook_image`;--> statement-breakpoint
CREATE INDEX `lookbook_image_order_idx` ON `lookbook_image` (`sort_order`,`id`);--> statement-breakpoint
CREATE TABLE `lookbook_image_section` (
	`id` text PRIMARY KEY NOT NULL,
	`image_id` text NOT NULL,
	`section` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	`point_id` text,
	FOREIGN KEY (`image_id`) REFERENCES `lookbook_image`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `lookbook_image_section` (`id`, `image_id`, `section`, `sort_order`, `created_at`, `updated_at`, `discarded_at`, `discard_operation_id`, `restored_at`, `point_id`)
SELECT `id`, `image_id`, `section`, `sort_order`, `created_at`, `updated_at`, `discarded_at`, `discard_operation_id`, `restored_at`, `point_id`
FROM `__preserved_lookbook_image_section`;--> statement-breakpoint
CREATE INDEX `lookbook_image_section_order_idx` ON `lookbook_image_section` (`section`,`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `lookbook_image_section_image_idx` ON `lookbook_image_section` (`image_id`);--> statement-breakpoint

CREATE TABLE `__new_lookbook_sheet` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_lookbook_sheet`("id", "asset_id", "sort_order", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at")
SELECT "id", "asset_id", "sort_order", "created_at", "updated_at", "discarded_at", "discard_operation_id", "restored_at"
FROM `lookbook_sheet`;--> statement-breakpoint
DROP TABLE `lookbook_sheet`;--> statement-breakpoint
ALTER TABLE `__new_lookbook_sheet` RENAME TO `lookbook_sheet`;--> statement-breakpoint
CREATE INDEX `lookbook_sheet_order_idx` ON `lookbook_sheet` (`sort_order`,`id`);--> statement-breakpoint

DELETE FROM `__asset_ownership_guard`;--> statement-breakpoint
INSERT INTO `__asset_ownership_guard`
SELECT CASE WHEN
	(SELECT COUNT(*) FROM `asset`) = (SELECT `asset_count` FROM `__asset_migration_inventory`)
	AND (SELECT COUNT(*) FROM `asset_file`) = (SELECT `asset_file_count` FROM `__asset_migration_inventory`)
	AND (SELECT COUNT(*) FROM `asset_file_generation`) = (SELECT `asset_file_generation_count` FROM `__asset_migration_inventory`)
	AND (SELECT COUNT(*) FROM `lookbook_image`) = (SELECT `lookbook_image_count` FROM `__asset_migration_inventory`)
	AND (SELECT COUNT(*) FROM `lookbook_sheet`) = (SELECT `lookbook_sheet_count` FROM `__asset_migration_inventory`)
	AND (SELECT COUNT(*) FROM `lookbook_image_section`) = (SELECT `lookbook_image_section_count` FROM `__asset_migration_inventory`)
	AND (SELECT COUNT(*) FROM `scene_dialogue_audio_take`) = (SELECT `dialogue_audio_take_count` FROM `__asset_migration_inventory`)
	AND (SELECT COUNT(*) FROM `cast_voice`) = (SELECT `cast_voice_count` FROM `__asset_migration_inventory`)
	AND NOT EXISTS (SELECT 1 FROM `pragma_foreign_key_check`)
	AND NOT EXISTS (
		SELECT 1
		FROM `pragma_quick_check`
		WHERE `quick_check` <> 'ok'
	)
THEN 1 ELSE 0 END;--> statement-breakpoint

DROP TABLE `__asset_ownership_guard`;--> statement-breakpoint
DROP TABLE `__asset_ownership_source`;--> statement-breakpoint
DROP TABLE `__asset_selection_source`;--> statement-breakpoint
DROP TABLE `__asset_migration_inventory`;--> statement-breakpoint
DROP TABLE `__preserved_lookbook_image_section`;--> statement-breakpoint
PRAGMA user_version = 53;
