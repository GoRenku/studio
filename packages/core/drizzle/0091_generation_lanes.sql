-- Project Settings version 7 introduces generation lanes. It adds the Image
-- Editing lane, a per-lane model (null means the Skill recommendation) and a
-- per-lane "Choose Provider and Model Each Time" preference, and drops the
-- retired displayPreview preference. This guarded JSON update is intentionally
-- custom because Drizzle's table-schema diff cannot express a versioned JSON
-- document migration.
CREATE TEMP TABLE `_generation_lanes_settings_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `_generation_lanes_settings_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM `project_settings`
	WHERE json_valid(`document`) = 0
) THEN 0 ELSE 1 END;--> statement-breakpoint
INSERT INTO `_generation_lanes_settings_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM `project_settings`
	WHERE json_type(`document`) <> 'object'
		OR json_type(`document`, '$.version') <> 'integer'
		OR json_extract(`document`, '$.version') <> 6
		OR json_type(`document`, '$.generation') <> 'object'
		OR (SELECT count(*) FROM json_each(json_extract(`document`, '$.generation'))) <> 5
		OR EXISTS (
			SELECT 1 FROM json_each(json_extract(`document`, '$.generation'))
			WHERE `key` NOT IN ('displayPreview', 'enableProviderPromptExpansion', 'image', 'video', 'audio')
		)
		OR EXISTS (
			SELECT 1
			FROM json_each(json_extract(`document`, '$.generation')) AS `lane`
			WHERE `lane`.`key` IN ('image', 'video', 'audio')
				AND (
					`lane`.`type` <> 'object'
					OR (SELECT count(*) FROM json_each(`lane`.`value`)) <> 4
					OR EXISTS (
						SELECT 1 FROM json_each(`lane`.`value`) AS `field`
						WHERE `field`.`key` NOT IN (
							'provider',
							'askBeforeGenerating',
							'runGenerationsConcurrently',
							'maxConcurrentGenerations'
						)
					)
				)
		)
) THEN 0 ELSE 1 END;--> statement-breakpoint
UPDATE `project_settings`
SET `document` = json_set(
	json_remove(`document`, '$.generation.displayPreview'),
	'$.version', 7,
	'$.generation.image.model', json('null'),
	'$.generation.image.chooseRouteBeforeGenerating', json('true'),
	'$.generation.imageEdit', json_object(
		'provider', 'fal-ai',
		'model', json('null'),
		'chooseRouteBeforeGenerating', json('true'),
		'askBeforeGenerating', json('true'),
		'runGenerationsConcurrently', json('false'),
		'maxConcurrentGenerations', 1
	),
	'$.generation.video.model', json('null'),
	'$.generation.video.chooseRouteBeforeGenerating', json('true'),
	'$.generation.audio.model', json('null'),
	'$.generation.audio.chooseRouteBeforeGenerating', json('true')
);--> statement-breakpoint
DROP TABLE `_generation_lanes_settings_guard`;--> statement-breakpoint
PRAGMA user_version = 73;
