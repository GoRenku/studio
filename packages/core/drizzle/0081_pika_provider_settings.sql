-- Project Settings version 4 adds Pika to the accepted provider unions. The
-- stored document needs only a version advance, so preserve every other value.
CREATE TEMP TABLE `_pika_provider_settings_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `_pika_provider_settings_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM `project_settings`
	WHERE json_valid(`document`) = 0
) THEN 0 ELSE 1 END;--> statement-breakpoint
INSERT INTO `_pika_provider_settings_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM `project_settings`
	WHERE json_type(`document`) <> 'object'
		OR json_type(`document`, '$.version') <> 'integer'
		OR json_extract(`document`, '$.version') <> 3
		OR (SELECT count(*) FROM json_each(`document`)) <> 3
		OR EXISTS (
			SELECT 1 FROM json_each(`document`)
			WHERE `key` NOT IN ('version', 'screenplayImport', 'generation')
		)
		OR json_type(`document`, '$.screenplayImport') <> 'object'
		OR (SELECT count(*) FROM json_each(json_extract(`document`, '$.screenplayImport'))) <> 5
		OR EXISTS (
			SELECT 1 FROM json_each(json_extract(`document`, '$.screenplayImport'))
			WHERE `key` NOT IN (
				'createContinuitySubjects',
				'generateContinuityImages',
				'runScreenplayAnalysis',
				'generateSceneBeats',
				'generateBeatStoryboardImages'
			)
				OR `type` NOT IN ('true', 'false')
		)
		OR json_type(`document`, '$.generation') <> 'object'
		OR (SELECT count(*) FROM json_each(json_extract(`document`, '$.generation'))) <> 4
		OR EXISTS (
			SELECT 1 FROM json_each(json_extract(`document`, '$.generation'))
			WHERE `key` NOT IN ('displayPreview', 'image', 'video', 'audio')
		)
		OR json_type(`document`, '$.generation.displayPreview') NOT IN ('true', 'false')
		OR coalesce(json_extract(`document`, '$.generation.image.provider') IN ('codex', 'fal-ai'), 0) = 0
		OR coalesce(json_extract(`document`, '$.generation.video.provider') = 'fal-ai', 0) = 0
		OR coalesce(json_extract(`document`, '$.generation.audio.provider') = 'elevenlabs', 0) = 0
		OR EXISTS (
			SELECT 1
			FROM json_each(json_extract(`document`, '$.generation')) AS `media`
			WHERE `media`.`key` IN ('image', 'video', 'audio')
				AND (
					`media`.`type` <> 'object'
					OR (SELECT count(*) FROM json_each(`media`.`value`)) <> 4
					OR EXISTS (
						SELECT 1 FROM json_each(`media`.`value`) AS `field`
						WHERE `field`.`key` NOT IN (
							'provider',
							'askBeforeGenerating',
							'runGenerationsConcurrently',
							'maxConcurrentGenerations'
						)
					)
					OR json_type(`media`.`value`, '$.askBeforeGenerating') NOT IN ('true', 'false')
					OR json_type(`media`.`value`, '$.runGenerationsConcurrently') NOT IN ('true', 'false')
					OR json_type(`media`.`value`, '$.maxConcurrentGenerations') <> 'integer'
					OR json_extract(`media`.`value`, '$.maxConcurrentGenerations') NOT BETWEEN 1 AND 5
				)
		)
) THEN 0 ELSE 1 END;--> statement-breakpoint
UPDATE `project_settings`
SET `document` = json_set(`document`, '$.version', 4);--> statement-breakpoint
DROP TABLE `_pika_provider_settings_guard`;
