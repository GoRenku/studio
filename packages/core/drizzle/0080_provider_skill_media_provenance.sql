-- Drizzle Kit generated the table and column changes below. This custom
-- preservation section converts populated Projects before obsolete tables go.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `asset` ADD `generation_provenance` text;--> statement-breakpoint
ALTER TABLE `asset` ADD `authored_from_shot_plan_id` text;--> statement-breakpoint
CREATE TEMP TABLE `_media_provenance_migration_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint

-- Compound Assets must resolve to one logical reviewed request.
INSERT INTO `_media_provenance_migration_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM `asset_file` AS `file`
	LEFT JOIN `asset_file_generation` AS `link` ON `link`.`asset_file_id` = `file`.`id`
	LEFT JOIN `media_generation_run` AS `run` ON `run`.`id` = `link`.`media_generation_run_id`
	WHERE `link`.`asset_file_id` IS NOT NULL OR `file`.`source_generation_spec_id` IS NOT NULL
	GROUP BY `file`.`asset_id`
	HAVING count(DISTINCT coalesce(`run`.`spec_id`, `file`.`source_generation_spec_id`)) > 1
		OR count(DISTINCT `link`.`media_generation_run_id`) > 1
) THEN 0 ELSE 1 END;--> statement-breakpoint

-- These are all provider fields emitted by the retired authoring layer.
INSERT INTO `_media_provenance_migration_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM `media_generation_spec` AS `spec`, json_each(`spec`.`references_json`) AS `reference`
	WHERE json_extract(`reference`.`value`, '$.providerField') IS NOT NULL
		AND json_extract(`reference`.`value`, '$.providerField') NOT IN ('image_url', 'end_image_url', 'image_urls')
) THEN 0 ELSE 1 END;--> statement-breakpoint

CREATE TEMP TABLE `_asset_generation_source` AS
SELECT
	`file`.`asset_id` AS `asset_id`,
	coalesce(`run`.`spec_id`, `file`.`source_generation_spec_id`) AS `spec_id`,
	max(`run`.`id`) AS `run_id`
FROM `asset_file` AS `file`
LEFT JOIN `asset_file_generation` AS `link` ON `link`.`asset_file_id` = `file`.`id`
LEFT JOIN `media_generation_run` AS `run` ON `run`.`id` = `link`.`media_generation_run_id`
WHERE `link`.`asset_file_id` IS NOT NULL OR `file`.`source_generation_spec_id` IS NOT NULL
GROUP BY `file`.`asset_id`, coalesce(`run`.`spec_id`, `file`.`source_generation_spec_id`);--> statement-breakpoint

CREATE TEMP TABLE `_asset_generation_request` AS
SELECT
	`source`.`asset_id`,
	`source`.`spec_id`,
	`source`.`run_id`,
	CASE WHEN `source`.`run_id` IS NOT NULL
		THEN `run`.`provider_payload_json`
		ELSE `spec`.`values_json`
	END AS `request_json`
FROM `_asset_generation_source` AS `source`
INNER JOIN `media_generation_spec` AS `spec` ON `spec`.`id` = `source`.`spec_id`
LEFT JOIN `media_generation_run` AS `run` ON `run`.`id` = `source`.`run_id`;--> statement-breakpoint

-- Restore durable LocalMediaFile markers in native provider fields. Temporary
-- uploaded URLs from submitted payloads are deliberately not retained.
UPDATE `_asset_generation_request`
SET `request_json` = json_set(
	`request_json`, '$.image_urls', json((
		SELECT json_group_array(json(
			CASE WHEN `reference_file`.`mime_type` IS NULL
				THEN json_object('$file', coalesce(`reference_file`.`project_relative_path`, json_extract(`reference`.`value`, '$.reference.projectRelativePath')))
				ELSE json_object('$file', coalesce(`reference_file`.`project_relative_path`, json_extract(`reference`.`value`, '$.reference.projectRelativePath')), 'mimeType', `reference_file`.`mime_type`)
			END
		))
		FROM `media_generation_spec` AS `spec`, json_each(`spec`.`references_json`) AS `reference`
		LEFT JOIN `asset_file` AS `reference_file` ON `reference_file`.`id` = json_extract(`reference`.`value`, '$.reference.assetFileId')
		WHERE `spec`.`id` = `_asset_generation_request`.`spec_id`
			AND json_extract(`reference`.`value`, '$.providerField') = 'image_urls'
	))
)
WHERE EXISTS (
	SELECT 1 FROM `media_generation_spec` AS `spec`, json_each(`spec`.`references_json`) AS `reference`
	WHERE `spec`.`id` = `_asset_generation_request`.`spec_id`
		AND json_extract(`reference`.`value`, '$.providerField') = 'image_urls'
);--> statement-breakpoint

UPDATE `_asset_generation_request`
SET `request_json` = json_set(
	`request_json`, '$.image_url', json((
		SELECT CASE WHEN `reference_file`.`mime_type` IS NULL
			THEN json_object('$file', coalesce(`reference_file`.`project_relative_path`, json_extract(`reference`.`value`, '$.reference.projectRelativePath')))
			ELSE json_object('$file', coalesce(`reference_file`.`project_relative_path`, json_extract(`reference`.`value`, '$.reference.projectRelativePath')), 'mimeType', `reference_file`.`mime_type`)
		END
		FROM `media_generation_spec` AS `spec`, json_each(`spec`.`references_json`) AS `reference`
		LEFT JOIN `asset_file` AS `reference_file` ON `reference_file`.`id` = json_extract(`reference`.`value`, '$.reference.assetFileId')
		WHERE `spec`.`id` = `_asset_generation_request`.`spec_id`
			AND json_extract(`reference`.`value`, '$.providerField') = 'image_url'
		LIMIT 1
	))
)
WHERE EXISTS (
	SELECT 1 FROM `media_generation_spec` AS `spec`, json_each(`spec`.`references_json`) AS `reference`
	WHERE `spec`.`id` = `_asset_generation_request`.`spec_id`
		AND json_extract(`reference`.`value`, '$.providerField') = 'image_url'
);--> statement-breakpoint

UPDATE `_asset_generation_request`
SET `request_json` = json_set(
	`request_json`, '$.end_image_url', json((
		SELECT CASE WHEN `reference_file`.`mime_type` IS NULL
			THEN json_object('$file', coalesce(`reference_file`.`project_relative_path`, json_extract(`reference`.`value`, '$.reference.projectRelativePath')))
			ELSE json_object('$file', coalesce(`reference_file`.`project_relative_path`, json_extract(`reference`.`value`, '$.reference.projectRelativePath')), 'mimeType', `reference_file`.`mime_type`)
		END
		FROM `media_generation_spec` AS `spec`, json_each(`spec`.`references_json`) AS `reference`
		LEFT JOIN `asset_file` AS `reference_file` ON `reference_file`.`id` = json_extract(`reference`.`value`, '$.reference.assetFileId')
		WHERE `spec`.`id` = `_asset_generation_request`.`spec_id`
			AND json_extract(`reference`.`value`, '$.providerField') = 'end_image_url'
		LIMIT 1
	))
)
WHERE EXISTS (
	SELECT 1 FROM `media_generation_spec` AS `spec`, json_each(`spec`.`references_json`) AS `reference`
	WHERE `spec`.`id` = `_asset_generation_request`.`spec_id`
		AND json_extract(`reference`.`value`, '$.providerField') = 'end_image_url'
);--> statement-breakpoint

-- General agent-external references remain an ordered opaque invocation value.
UPDATE `_asset_generation_request`
SET `request_json` = json_set(
	`request_json`, '$.references', json((
		SELECT json_group_array(json(
			CASE WHEN `reference_file`.`mime_type` IS NULL
				THEN json_object('$file', coalesce(`reference_file`.`project_relative_path`, json_extract(`reference`.`value`, '$.reference.projectRelativePath')))
				ELSE json_object('$file', coalesce(`reference_file`.`project_relative_path`, json_extract(`reference`.`value`, '$.reference.projectRelativePath')), 'mimeType', `reference_file`.`mime_type`)
			END
		))
		FROM `media_generation_spec` AS `spec`, json_each(`spec`.`references_json`) AS `reference`
		LEFT JOIN `asset_file` AS `reference_file` ON `reference_file`.`id` = json_extract(`reference`.`value`, '$.reference.assetFileId')
		WHERE `spec`.`id` = `_asset_generation_request`.`spec_id`
			AND json_extract(`reference`.`value`, '$.providerField') IS NULL
	))
)
WHERE EXISTS (
	SELECT 1 FROM `media_generation_spec` AS `spec`, json_each(`spec`.`references_json`) AS `reference`
	WHERE `spec`.`id` = `_asset_generation_request`.`spec_id`
		AND json_extract(`reference`.`value`, '$.providerField') IS NULL
);--> statement-breakpoint

-- Durable data cannot keep secret-bearing or temporary transport values.
INSERT INTO `_media_provenance_migration_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM `_asset_generation_request` AS `request`
	LEFT JOIN `media_generation_run` AS `run` ON `run`.`id` = `request`.`run_id`
	WHERE json_valid(`request`.`request_json`) = 0
		OR lower(`request`.`request_json`) LIKE '%authorization%'
		OR lower(`request`.`request_json`) LIKE '%api_key%'
		OR lower(`request`.`request_json`) LIKE '%api-key%'
		OR lower(`request`.`request_json`) LIKE '%access_token%'
		OR lower(`request`.`request_json`) LIKE '%fal.media%'
		OR lower(`request`.`request_json`) LIKE '%replicate.delivery%'
		OR lower(`request`.`request_json`) LIKE '%cdn.wavespeed.ai%'
		OR lower(`request`.`request_json`) LIKE '%x-amz-signature%'
		OR (`run`.`receipt_json` IS NOT NULL AND (
			json_valid(`run`.`receipt_json`) = 0
			OR lower(`run`.`receipt_json`) LIKE '%authorization%'
			OR lower(`run`.`receipt_json`) LIKE '%api_key%'
			OR lower(`run`.`receipt_json`) LIKE '%access_token%'
			OR lower(`run`.`receipt_json`) LIKE '%x-amz-signature%'
		))
) THEN 0 ELSE 1 END;--> statement-breakpoint

UPDATE `asset`
SET
	`generation_provenance` = (
		SELECT CASE WHEN `run`.`receipt_json` IS NULL
			THEN json_object(
				'provider', `spec`.`provider`, 'model', `spec`.`model`,
				'mediaKind', `asset`.`media_kind`,
				'prompt', json_extract(`spec`.`values_json`, '$.prompt'),
				'request', json(`request`.`request_json`)
			)
			ELSE json_object(
				'provider', `spec`.`provider`, 'model', `spec`.`model`,
				'mediaKind', `asset`.`media_kind`,
				'prompt', json_extract(`spec`.`values_json`, '$.prompt'),
				'request', json(`request`.`request_json`),
				'receipt', json(`run`.`receipt_json`)
			)
		END
		FROM `_asset_generation_request` AS `request`
		INNER JOIN `media_generation_spec` AS `spec` ON `spec`.`id` = `request`.`spec_id`
		LEFT JOIN `media_generation_run` AS `run` ON `run`.`id` = `request`.`run_id`
		WHERE `request`.`asset_id` = `asset`.`id`
	),
	`authored_from_shot_plan_id` = (
		SELECT `spec`.`authored_from_shot_plan_id`
		FROM `_asset_generation_request` AS `request`
		INNER JOIN `media_generation_spec` AS `spec` ON `spec`.`id` = `request`.`spec_id`
		WHERE `request`.`asset_id` = `asset`.`id`
	)
WHERE EXISTS (SELECT 1 FROM `_asset_generation_request` AS `request` WHERE `request`.`asset_id` = `asset`.`id`);--> statement-breakpoint

-- Preserve effective v2 behavior in the exact current per-media document.
UPDATE `project_settings`
SET `document` = json_object(
	'version', 3,
	'screenplayImport', json(json_extract(`document`, '$.screenplayImport')),
	'generation', json_object(
		'displayPreview', json(CASE WHEN json_extract(`document`, '$.generation.displayPreview') THEN 'true' ELSE 'false' END),
		'image', json_object(
			'provider', CASE WHEN json_extract(`document`, '$.generation.preferCodexImageGeneration') THEN 'codex' ELSE 'fal-ai' END,
			'askBeforeGenerating', json(CASE WHEN CASE WHEN json_extract(`document`, '$.generation.preferCodexImageGeneration') THEN json_extract(`document`, '$.generation.codexBuiltIn.requirePerRunConfirmation') ELSE json_extract(`document`, '$.generation.renkuManaged.requirePerRunConfirmation') END THEN 'true' ELSE 'false' END),
			'runGenerationsConcurrently', json(CASE WHEN CASE WHEN json_extract(`document`, '$.generation.preferCodexImageGeneration') THEN json_extract(`document`, '$.generation.codexBuiltIn.allowConcurrentGenerations') ELSE json_extract(`document`, '$.generation.renkuManaged.allowConcurrentGenerations') END THEN 'true' ELSE 'false' END),
			'maxConcurrentGenerations', CASE WHEN json_extract(`document`, '$.generation.preferCodexImageGeneration') THEN json_extract(`document`, '$.generation.codexBuiltIn.maxConcurrentGenerations') ELSE json_extract(`document`, '$.generation.renkuManaged.maxConcurrentGenerations') END
		),
		'video', json_object(
			'provider', 'fal-ai',
			'askBeforeGenerating', json(CASE WHEN json_extract(`document`, '$.generation.renkuManaged.requirePerRunConfirmation') THEN 'true' ELSE 'false' END),
			'runGenerationsConcurrently', json(CASE WHEN json_extract(`document`, '$.generation.renkuManaged.allowConcurrentGenerations') THEN 'true' ELSE 'false' END),
			'maxConcurrentGenerations', json_extract(`document`, '$.generation.renkuManaged.maxConcurrentGenerations')
		),
		'audio', json_object(
			'provider', 'elevenlabs',
			'askBeforeGenerating', json(CASE WHEN json_extract(`document`, '$.generation.renkuManaged.requirePerRunConfirmation') THEN 'true' ELSE 'false' END),
			'runGenerationsConcurrently', json(CASE WHEN json_extract(`document`, '$.generation.renkuManaged.allowConcurrentGenerations') THEN 'true' ELSE 'false' END),
			'maxConcurrentGenerations', json_extract(`document`, '$.generation.renkuManaged.maxConcurrentGenerations')
		)
	)
)
WHERE json_extract(`document`, '$.version') = 2;--> statement-breakpoint

DROP TABLE `_asset_generation_request`;--> statement-breakpoint
DROP TABLE `_asset_generation_source`;--> statement-breakpoint
DROP TABLE `_media_provenance_migration_guard`;--> statement-breakpoint
DROP TABLE `asset_file_generation`;--> statement-breakpoint
-- Keep retained dialogue and screenplay children intact. Drizzle Kit's
-- generated parent-table rebuild cannot run with foreign keys enabled inside
-- its transaction, so remove the obsolete nullable column in place.
ALTER TABLE `asset_file` DROP COLUMN `source_generation_spec_id`;--> statement-breakpoint
DROP TABLE `media_generation_run`;--> statement-breakpoint
DROP TABLE `media_generation_spec`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA user_version = 65;
