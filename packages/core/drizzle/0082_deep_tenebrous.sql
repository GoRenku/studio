CREATE TABLE `scene_dialogue_audio_take_selection` (
	`scene_dialogue_audio_id` text PRIMARY KEY NOT NULL,
	`take_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scene_dialogue_audio_id`) REFERENCES `scene_dialogue_audio`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`take_id`) REFERENCES `scene_dialogue_audio_take`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scene_dialogue_audio_take_selection_take_id_unique` ON `scene_dialogue_audio_take_selection` (`take_id`);--> statement-breakpoint
CREATE INDEX `scene_dialogue_audio_take_selection_take_idx` ON `scene_dialogue_audio_take_selection` (`take_id`);--> statement-breakpoint
-- Project Settings version 5 adds a provider prompt-expansion preference. This
-- guarded JSON update is intentionally custom because Drizzle's table-schema
-- diff cannot express a versioned JSON document migration.
CREATE TEMP TABLE `_provider_prompt_expansion_settings_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `_provider_prompt_expansion_settings_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM `project_settings`
	WHERE json_valid(`document`) = 0
) THEN 0 ELSE 1 END;--> statement-breakpoint
INSERT INTO `_provider_prompt_expansion_settings_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM `project_settings`
	WHERE json_type(`document`) <> 'object'
		OR json_type(`document`, '$.version') <> 'integer'
		OR json_extract(`document`, '$.version') <> 4
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
		OR coalesce(json_extract(`document`, '$.generation.image.provider') IN ('codex', 'fal-ai', 'pika'), 0) = 0
		OR coalesce(json_extract(`document`, '$.generation.video.provider') IN ('fal-ai', 'pika'), 0) = 0
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
SET `document` = json_set(
	`document`,
	'$.version', 5,
	'$.generation.enableProviderPromptExpansion', json('true')
);--> statement-breakpoint
DROP TABLE `_provider_prompt_expansion_settings_guard`;--> statement-breakpoint
PRAGMA user_version=66;
