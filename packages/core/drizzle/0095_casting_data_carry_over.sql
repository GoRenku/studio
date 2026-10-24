-- Plan 0242 moves costumes out of Cast Design and makes age changes Looks of
-- one Cast Member. Drizzle's schema diff cannot express these JSON document
-- conversions, so this migration is custom:
-- 1. Each Cast Member whose active Cast Design has costume variants gets one
--    "Main" Look, and every variant becomes a cast_costume under it, in order,
--    keeping its label, wardrobe and continuity notes word for word. Variants
--    scoped to scenes keep those scenes on the costume and the Look.
-- 2. `costume.variants` is removed from every Cast Design revision.
-- 3. Shared arcs (`characterArcReference`) existed only for age variants and
--    are cleared.
-- 4. The turning point field `lookAssetFileId` becomes
--    `characterSheetAssetFileId`, so "look" means only a Cast Look.
-- 5. Project Settings version 8 adds empty casting defaults.
-- Runtime reads now require these shapes and the casting tables, so the
-- schema generation advances.
CREATE TEMP TABLE `_casting_settings_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `_casting_settings_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM `project_settings`
	WHERE json_valid(`document`) = 0
		OR json_extract(`document`, '$.version') <> 7
		OR json_type(`document`, '$.casting') IS NOT NULL
) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `_casting_settings_guard`;--> statement-breakpoint
UPDATE `project_settings`
SET `document` = json_set(`document`, '$.version', 8, '$.casting', json_object('routes', json_array()));--> statement-breakpoint
CREATE TEMP TABLE `_casting_main_look` AS
SELECT
	`state`.`cast_member_id` AS `cast_member_id`,
	'cast_look_' || lower(hex(randomblob(4))) AS `look_id`,
	`design`.`document_json` AS `document_json`
FROM `cast_design_state` AS `state`
JOIN `cast_design` AS `design` ON `design`.`id` = `state`.`active_design_id`
WHERE json_array_length(`design`.`document_json`, '$.design.costume.variants') > 0;--> statement-breakpoint
INSERT INTO `cast_look` (`id`, `cast_member_id`, `name`, `description`, `position`, `created_at`, `updated_at`)
SELECT `look_id`, `cast_member_id`, 'Main', NULL, 0,
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `_casting_main_look`;--> statement-breakpoint
CREATE TEMP TABLE `_casting_costume` AS
SELECT
	`main`.`cast_member_id` AS `cast_member_id`,
	`main`.`look_id` AS `look_id`,
	'cast_costume_' || lower(hex(randomblob(4))) AS `costume_id`,
	CAST(`variant`.`key` AS integer) AS `position`,
	`variant`.`value` AS `variant`
FROM `_casting_main_look` AS `main`, json_each(`main`.`document_json`, '$.design.costume.variants') AS `variant`;--> statement-breakpoint
INSERT INTO `cast_costume` (`id`, `cast_member_id`, `cast_look_id`, `name`, `wardrobe_json`, `continuity_notes_json`, `position`, `created_at`, `updated_at`)
SELECT
	`costume_id`, `cast_member_id`, `look_id`,
	json_extract(`variant`, '$.label'),
	json(json_extract(`variant`, '$.wardrobe')),
	coalesce(json(json_extract(`variant`, '$.continuityNotes')), json_array()),
	`position`,
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `_casting_costume`;--> statement-breakpoint
INSERT OR IGNORE INTO `cast_costume_scene` (`cast_member_id`, `cast_costume_id`, `scene_id`)
SELECT `costume`.`cast_member_id`, `costume`.`costume_id`, `scene`.`value`
FROM `_casting_costume` AS `costume`, json_each(`costume`.`variant`, '$.scope.sceneIds') AS `scene`
WHERE json_extract(`costume`.`variant`, '$.scope.kind') = 'scenes'
	AND `scene`.`value` IN (SELECT `id` FROM `scene`)
ORDER BY `costume`.`position`;--> statement-breakpoint
INSERT OR IGNORE INTO `cast_look_scene` (`cast_member_id`, `cast_look_id`, `scene_id`)
SELECT `costume`.`cast_member_id`, `costume`.`look_id`, `scene`.`scene_id`
FROM `_casting_costume` AS `costume`
JOIN `cast_costume_scene` AS `scene` ON `scene`.`cast_costume_id` = `costume`.`costume_id`;--> statement-breakpoint
DROP TABLE `_casting_costume`;--> statement-breakpoint
DROP TABLE `_casting_main_look`;--> statement-breakpoint
UPDATE `cast_design`
SET `document_json` = json_remove(`document_json`, '$.design.costume.variants')
WHERE json_type(`document_json`, '$.design.costume.variants') IS NOT NULL;--> statement-breakpoint
UPDATE `cast_member`
SET `character_arc` = NULL
WHERE json_extract(`character_arc`, '$.arc.kind') = 'characterArcReference';--> statement-breakpoint
UPDATE `cast_member`
SET `character_arc` = json_set(`character_arc`, '$.arc.turningPoints', (
	SELECT json_group_array(json(`point`))
	FROM (
		SELECT CASE
			WHEN json_type(`turning_point`.`value`, '$.lookAssetFileId') IS NULL THEN json(`turning_point`.`value`)
			ELSE json_set(
				json_remove(`turning_point`.`value`, '$.lookAssetFileId'),
				'$.characterSheetAssetFileId',
				json_extract(`turning_point`.`value`, '$.lookAssetFileId')
			)
		END AS `point`
		FROM json_each(`cast_member`.`character_arc`, '$.arc.turningPoints') AS `turning_point`
		ORDER BY `turning_point`.`key`
	)
))
WHERE json_type(`character_arc`, '$.arc.turningPoints') = 'array';--> statement-breakpoint
PRAGMA user_version = 76;
