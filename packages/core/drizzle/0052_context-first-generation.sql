-- Drizzle Kit generated the structural diff for the generic generation tables.
-- The custom statements below preserve provenance-backed generation requests,
-- migrate exact Shot selections, and remove retired Shot generation state.
-- See ADR 0047 and the context-first generation migration preflight.
PRAGMA foreign_keys=OFF;--> statement-breakpoint

CREATE TEMP TABLE `__context_first_direction` (
	`take_id` text NOT NULL,
	`scope_id` text,
	`references_json` text NOT NULL
);--> statement-breakpoint
INSERT INTO `__context_first_direction` (`take_id`, `scope_id`, `references_json`)
SELECT `id`, NULL, json_extract(`state_json`, '$.structure.sharedDirection.referenceSelections')
FROM `scene_shot_video_take`
WHERE json_type(`state_json`, '$.structure.sharedDirection.referenceSelections') = 'object';--> statement-breakpoint
INSERT INTO `__context_first_direction` (`take_id`, `scope_id`, `references_json`)
SELECT take.`id`, direction.`key`, json_extract(direction.`value`, '$.referenceSelections')
FROM `scene_shot_video_take` take, json_each(take.`state_json`, '$.structure.directionsByShotId') direction
WHERE json_type(direction.`value`, '$.referenceSelections') = 'object';--> statement-breakpoint

CREATE TEMP TABLE `__context_first_assert` (
	`invalid_count` integer NOT NULL CHECK (`invalid_count` = 0)
);--> statement-breakpoint
INSERT INTO `__context_first_assert`
SELECT count(*)
FROM `scene_shot_video_take_media_input` input
LEFT JOIN `asset` asset ON asset.`id` = input.`asset_id` AND asset.`discarded_at` IS NULL
LEFT JOIN `asset_file` file ON file.`id` = input.`asset_file_id` AND file.`asset_id` = input.`asset_id` AND file.`discarded_at` IS NULL
WHERE input.`discarded_at` IS NULL
  AND (input.`input_kind` NOT IN ('first-frame', 'last-frame', 'video-prompt-sheet', 'reference-image') OR asset.`id` IS NULL OR file.`id` IS NULL);--> statement-breakpoint
INSERT INTO `__context_first_assert`
SELECT count(*) FROM (
	SELECT selection.`value` AS `asset_id`
	FROM `__context_first_direction` direction, json_each(direction.`references_json`, '$.selectedCharacterSheetAssetIds') selection
	UNION ALL
	SELECT selection.`value`
	FROM `__context_first_direction` direction, json_each(direction.`references_json`, '$.selectedLocationSheetAssetIds') selection
) selection
WHERE (
	SELECT count(*)
	FROM `asset_file`
	JOIN `asset` ON asset.`id` = `asset_file`.`asset_id` AND asset.`discarded_at` IS NULL
	WHERE `asset_file`.`asset_id` = selection.`asset_id` AND `asset_file`.`discarded_at` IS NULL
) <> 1;--> statement-breakpoint
INSERT INTO `__context_first_assert`
SELECT count(*)
FROM `__context_first_direction` direction, json_each(direction.`references_json`, '$.selectedLookbookSheetIds') selection
LEFT JOIN `lookbook_sheet` sheet ON sheet.`id` = selection.`value` AND sheet.`discarded_at` IS NULL
WHERE sheet.`id` IS NULL OR (
	SELECT count(*) FROM `asset_file`
	JOIN `asset` ON asset.`id` = `asset_file`.`asset_id` AND asset.`discarded_at` IS NULL
	WHERE `asset_file`.`asset_id` = sheet.`asset_id` AND `asset_file`.`discarded_at` IS NULL
) <> 1;--> statement-breakpoint
INSERT INTO `__context_first_assert`
SELECT count(*)
FROM `__context_first_direction` direction, json_each(direction.`references_json`, '$.selectedDialogueAudioTakeIds') selection
LEFT JOIN `scene_dialogue_audio_take` audio_take ON audio_take.`id` = selection.`value` AND audio_take.`discarded_at` IS NULL
LEFT JOIN `asset` asset ON asset.`id` = audio_take.`asset_id` AND asset.`discarded_at` IS NULL
LEFT JOIN `asset_file` file ON file.`id` = audio_take.`asset_file_id` AND file.`asset_id` = audio_take.`asset_id` AND file.`discarded_at` IS NULL
WHERE audio_take.`id` IS NULL OR asset.`id` IS NULL OR file.`id` IS NULL;--> statement-breakpoint

CREATE TEMP TABLE `__context_first_reference` (
	`take_id` text NOT NULL,
	`sort_key` text NOT NULL,
	`selection_id` text NOT NULL,
	`section_id` text NOT NULL,
	`slot_id` text NOT NULL,
	`scope_kind` text,
	`scope_id` text,
	`subject_kind` text,
	`subject_id` text,
	`included` integer NOT NULL,
	`asset_id` text NOT NULL,
	`asset_file_id` text NOT NULL
);--> statement-breakpoint

INSERT INTO `__context_first_reference`
SELECT input.`take_id`,
	'10:' || input.`created_at` || ':' || input.`id`,
	'migrated:' || input.`id`,
	'shot',
	CASE input.`input_kind`
		WHEN 'first-frame' THEN 'first-frame'
		WHEN 'last-frame' THEN 'last-frame'
		WHEN 'video-prompt-sheet' THEN 'video-prompt-sheet'
		ELSE 'general-reference'
	END,
	CASE WHEN input.`subject_kind` = 'shot' AND (
		SELECT json_extract(take.`state_json`, '$.structure.mode')
		FROM `scene_shot_video_take` take
		WHERE take.`id` = input.`take_id`
	) = 'multi-cut' THEN 'shot' ELSE NULL END,
	CASE WHEN input.`subject_kind` = 'shot' AND (
		SELECT json_extract(take.`state_json`, '$.structure.mode')
		FROM `scene_shot_video_take` take
		WHERE take.`id` = input.`take_id`
	) = 'multi-cut' THEN input.`subject_id` ELSE NULL END,
	NULL,
	NULL,
	CASE WHEN coalesce((
		SELECT json_extract(
			direction.`references_json`,
			'$.dependencyInclusions."' || input.`input_kind` || ':' || input.`subject_kind` || ':' || input.`subject_id` || '"'
		)
		FROM `__context_first_direction` direction
		WHERE direction.`take_id` = input.`take_id`
		  AND (direction.`scope_id` = input.`subject_id` OR direction.`scope_id` IS NULL)
		ORDER BY direction.`scope_id` IS NOT NULL DESC
		LIMIT 1
	), '') = 'exclude' THEN 0 WHEN input.`selection` = 'select' THEN 1 ELSE 0 END,
	input.`asset_id`,
	input.`asset_file_id`
FROM `scene_shot_video_take_media_input` input
WHERE input.`discarded_at` IS NULL;--> statement-breakpoint

INSERT INTO `__context_first_reference`
SELECT direction.`take_id`,
	'20:' || coalesce(direction.`scope_id`, '') || ':' || selection.`key`,
	'migrated:' || direction.`take_id` || ':cast:' || coalesce(direction.`scope_id`, 'shared') || ':' || selection.`key`,
	'cast', 'video-character-sheet',
	CASE WHEN direction.`scope_id` IS NOT NULL THEN 'shot' ELSE NULL END,
	direction.`scope_id`, 'castMember', selection.`key`,
	CASE WHEN coalesce(
		json_extract(direction.`references_json`, '$.dependencyInclusions."cast-character-sheet:' || selection.`key` || '"'),
		json_extract(direction.`references_json`, '$.dependencyInclusions."cast-character-sheet:' || selection.`key` || ':' || selection.`value` || '"')
	) = 'exclude' THEN 0 ELSE 1 END,
	selection.`value`,
	(SELECT file.`id` FROM `asset_file` file WHERE file.`asset_id` = selection.`value` AND file.`discarded_at` IS NULL)
FROM `__context_first_direction` direction, json_each(direction.`references_json`, '$.selectedCharacterSheetAssetIds') selection;--> statement-breakpoint

INSERT INTO `__context_first_reference`
SELECT direction.`take_id`,
	'30:' || coalesce(direction.`scope_id`, '') || ':' || selection.`key`,
	'migrated:' || direction.`take_id` || ':location:' || coalesce(direction.`scope_id`, 'shared') || ':' || selection.`key`,
	'location', 'location-sheet',
	CASE WHEN direction.`scope_id` IS NOT NULL THEN 'shot' ELSE NULL END,
	direction.`scope_id`, 'location', selection.`key`,
	CASE WHEN coalesce(
		json_extract(direction.`references_json`, '$.dependencyInclusions."location-environment-sheet:' || selection.`key` || '"'),
		json_extract(direction.`references_json`, '$.dependencyInclusions."location-environment-sheet:' || selection.`key` || ':' || selection.`value` || '"')
	) = 'exclude' THEN 0 ELSE 1 END,
	selection.`value`,
	(SELECT file.`id` FROM `asset_file` file WHERE file.`asset_id` = selection.`value` AND file.`discarded_at` IS NULL)
FROM `__context_first_direction` direction, json_each(direction.`references_json`, '$.selectedLocationSheetAssetIds') selection;--> statement-breakpoint

INSERT INTO `__context_first_reference`
SELECT direction.`take_id`,
	'40:' || coalesce(direction.`scope_id`, '') || ':' || printf('%08d', cast(selection.`key` AS integer)),
	'migrated:' || direction.`take_id` || ':lookbook:' || coalesce(direction.`scope_id`, 'shared') || ':' || selection.`value`,
	'lookbook', 'video-lookbook-sheet',
	CASE WHEN direction.`scope_id` IS NOT NULL THEN 'shot' ELSE NULL END,
	direction.`scope_id`, NULL, NULL,
	CASE WHEN json_extract(direction.`references_json`, '$.dependencyInclusions."lookbook-sheet:' || sheet.`lookbook_id` || '"') = 'exclude' THEN 0 ELSE 1 END,
	sheet.`asset_id`,
	(SELECT file.`id` FROM `asset_file` file WHERE file.`asset_id` = sheet.`asset_id` AND file.`discarded_at` IS NULL)
FROM `__context_first_direction` direction, json_each(direction.`references_json`, '$.selectedLookbookSheetIds') selection
JOIN `lookbook_sheet` sheet ON sheet.`id` = selection.`value` AND sheet.`discarded_at` IS NULL;--> statement-breakpoint

INSERT INTO `__context_first_reference`
SELECT direction.`take_id`,
	'50:' || coalesce(direction.`scope_id`, '') || ':' || selection.`key`,
	'migrated:' || direction.`take_id` || ':dialogue:' || coalesce(direction.`scope_id`, 'shared') || ':' || selection.`key`,
	'dialogue', 'dialogue-audio',
	CASE WHEN direction.`scope_id` IS NOT NULL THEN 'shot' ELSE NULL END,
	direction.`scope_id`, 'sceneDialogue', selection.`key`,
	CASE WHEN json_extract(direction.`references_json`, '$.dependencyInclusions."audio:scene-dialogue:' || selection.`key` || '"') = 'exclude' THEN 0 ELSE 1 END,
	audio_take.`asset_id`, audio_take.`asset_file_id`
FROM `__context_first_direction` direction, json_each(direction.`references_json`, '$.selectedDialogueAudioTakeIds') selection
JOIN `scene_dialogue_audio_take` audio_take ON audio_take.`id` = selection.`value` AND audio_take.`discarded_at` IS NULL;--> statement-breakpoint

CREATE TEMP TABLE `__context_first_legacy_spec` AS
SELECT spec.*
FROM `media_generation_spec` spec
WHERE EXISTS (
	SELECT 1
	FROM `media_generation_run` run
	JOIN `asset_file_generation` provenance ON provenance.`media_generation_run_id` = run.`id`
	WHERE run.`spec_id` = spec.`id`
);--> statement-breakpoint
CREATE TEMP TABLE `__context_first_legacy_run` AS
SELECT DISTINCT run.*
FROM `media_generation_run` run
JOIN `asset_file_generation` provenance ON provenance.`media_generation_run_id` = run.`id`;--> statement-breakpoint
CREATE TEMP TABLE `__context_first_legacy_provenance` AS
SELECT provenance.*
FROM `asset_file_generation` provenance
JOIN `__context_first_legacy_run` run ON run.`id` = provenance.`media_generation_run_id`;--> statement-breakpoint

CREATE TEMP TABLE `__context_first_legacy_reference` (
	`run_id` text NOT NULL,
	`sort_key` text NOT NULL,
	`selection_json` text NOT NULL
);--> statement-breakpoint
INSERT INTO `__context_first_legacy_reference`
SELECT run.`id`,
	'10:' || field.`key` || ':' || printf('%08d', cast(reference.`key` AS integer)),
	json_object(
		'id', 'migrated:' || run.`id` || ':' || field.`key` || ':' || reference.`key`,
		'placement', json_object('kind', 'additional'),
		'included', json('true'),
		'providerField', field.`key`,
		'reference', json(
			CASE WHEN file.`id` IS NOT NULL THEN
				json_object('kind', 'asset-file', 'assetId', file.`asset_id`, 'assetFileId', file.`id`)
			ELSE
				json_object('kind', 'project-file', 'projectRelativePath', substr(reference.`value`, length('renku-input://') + 1))
			END
		)
	)
FROM `__context_first_legacy_run` run,
	json_each(run.`provider_payload_json`) field,
	json_each(CASE WHEN field.`type` = 'array' THEN field.`value` ELSE json_array(field.`value`) END) reference
LEFT JOIN `asset_file` file
	ON file.`project_relative_path` = substr(reference.`value`, length('renku-input://') + 1)
	AND file.`discarded_at` IS NULL
WHERE reference.`type` = 'text'
	AND reference.`value` LIKE 'renku-input://%';--> statement-breakpoint

INSERT INTO `__context_first_legacy_reference`
SELECT run.`id`,
	'20:' || printf('%08d', cast(input.`key` AS integer)),
	json_object(
		'id', 'migrated:' || run.`id` || ':shot-input:' || input.`key`,
		'placement', json(
			CASE WHEN json_extract(input.`value`, '$.subjectKind') = 'shot' THEN
				json_object(
					'kind', 'slot',
					'sectionId', 'shot',
					'slotId', CASE json_extract(input.`value`, '$.kind')
						WHEN 'first-frame' THEN 'first-frame'
						WHEN 'last-frame' THEN 'last-frame'
						WHEN 'video-prompt-sheet' THEN 'video-prompt-sheet'
						ELSE 'general-reference'
					END,
					'scope', json_object('kind', 'shot', 'id', json_extract(input.`value`, '$.subjectId'))
				)
			ELSE
				json_object(
					'kind', 'slot',
					'sectionId', 'shot',
					'slotId', CASE json_extract(input.`value`, '$.kind')
						WHEN 'first-frame' THEN 'first-frame'
						WHEN 'last-frame' THEN 'last-frame'
						WHEN 'video-prompt-sheet' THEN 'video-prompt-sheet'
						ELSE 'general-reference'
					END
				)
			END
		),
		'included', json('true'),
		'reference', json_object(
			'kind', 'asset-file',
			'assetId', json_extract(input.`value`, '$.assetId'),
			'assetFileId', json_extract(input.`value`, '$.assetFileId')
		)
	)
FROM `__context_first_legacy_run` run,
	json_each(run.`spec_snapshot_json`, '$.inputs') input
JOIN `asset_file` file
	ON file.`id` = json_extract(input.`value`, '$.assetFileId')
	AND file.`asset_id` = json_extract(input.`value`, '$.assetId')
	AND file.`discarded_at` IS NULL
WHERE json_type(run.`spec_snapshot_json`, '$.inputs') = 'array'
	AND NOT EXISTS (
		SELECT 1
		FROM `__context_first_legacy_reference` reference
		WHERE reference.`run_id` = run.`id`
			AND json_extract(reference.`selection_json`, '$.reference.assetFileId') = file.`id`
	);--> statement-breakpoint

CREATE TEMP TABLE `__context_first_legacy_request` AS
SELECT run.`id` AS `run_id`, run.`spec_id`,
	CASE spec.`purpose`
		WHEN 'cast.character-sheet' THEN 'cast.video-character-sheet'
		WHEN 'location.environment-sheet' THEN 'location.sheet'
		WHEN 'lookbook.sheet' THEN CASE (
			SELECT lookbook.`type` FROM `lookbook` lookbook WHERE lookbook.`id` = spec.`target_id`
		) WHEN 'storyboard' THEN 'lookbook.storyboard-sheet' ELSE 'lookbook.video-sheet' END
		ELSE spec.`purpose`
	END AS `purpose`,
	spec.`target_kind`,
	CASE WHEN spec.`purpose` = 'scene.dialogue-audio' THEN
		coalesce(
			json_extract(run.`spec_snapshot_json`, '$.target.dialogueId'),
			substr(spec.`target_id`, instr(spec.`target_id`, ':') + 1)
		)
	ELSE spec.`target_id` END AS `target_id`,
	run.`provider`, run.`model`, spec.`title`,
	coalesce((
		SELECT json_group_object(
			field.`key`,
			json(CASE field.`type`
				WHEN 'text' THEN json_quote(field.`value`)
				WHEN 'true' THEN 'true'
				WHEN 'false' THEN 'false'
				WHEN 'null' THEN 'null'
				ELSE cast(field.`value` AS text)
			END)
		)
		FROM json_each(run.`provider_payload_json`) field
		WHERE NOT EXISTS (
			SELECT 1
			FROM json_each(CASE WHEN field.`type` = 'array' THEN field.`value` ELSE json_array(field.`value`) END) reference
			WHERE reference.`type` = 'text' AND reference.`value` LIKE 'renku-input://%'
		)
	), '{}') AS `values_json`,
	coalesce((
		SELECT json_group_array(json(reference.`selection_json`))
		FROM (
			SELECT migrated.`selection_json`
			FROM `__context_first_legacy_reference` migrated
			WHERE migrated.`run_id` = run.`id`
			ORDER BY migrated.`sort_key`
		) reference
	), '[]') AS `references_json`,
	spec.`created_at`, spec.`updated_at`, run.`provider_payload_json`,
	run.`estimate_snapshot_json`, run.`status`, run.`outputs_json`,
	run.`started_at`, run.`completed_at`
FROM `__context_first_legacy_run` run
JOIN `__context_first_legacy_spec` spec ON spec.`id` = run.`spec_id`;--> statement-breakpoint

DELETE FROM `asset_file_generation`;--> statement-breakpoint
DROP TABLE `media_generation_run`;--> statement-breakpoint
DROP TABLE `media_generation_spec`;--> statement-breakpoint

CREATE TABLE `__new_media_generation_spec` (
	`id` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`provider` text,
	`model` text,
	`title` text,
	`values_json` text NOT NULL,
	`references_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
ALTER TABLE `__new_media_generation_spec` RENAME TO `media_generation_spec`;--> statement-breakpoint
CREATE INDEX `media_generation_spec_target_idx` ON `media_generation_spec` (`purpose`,`target_kind`,`target_id`,`updated_at`);--> statement-breakpoint

CREATE TABLE `media_generation_run` (
	`id` text PRIMARY KEY NOT NULL,
	`spec_id` text NOT NULL,
	`purpose` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`spec_snapshot_json` text NOT NULL,
	`provider_payload_json` text NOT NULL,
	`estimate_json` text NOT NULL,
	`approval_token` text NOT NULL,
	`status` text NOT NULL,
	`outputs_json` text NOT NULL,
	`receipt_json` text,
	`diagnostics_json` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`spec_id`) REFERENCES `media_generation_spec`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `media_generation_run_spec_idx` ON `media_generation_run` (`spec_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `media_generation_run_target_idx` ON `media_generation_run` (`purpose`,`target_kind`,`target_id`,`started_at`);--> statement-breakpoint

INSERT INTO `media_generation_spec` (
	`id`, `purpose`, `target_kind`, `target_id`, `provider`, `model`, `title`,
	`values_json`, `references_json`, `created_at`, `updated_at`
)
SELECT request.`spec_id`, request.`purpose`, request.`target_kind`, request.`target_id`,
	request.`provider`, request.`model`, request.`title`, request.`values_json`,
	request.`references_json`, request.`created_at`,
	CASE WHEN request.`purpose` = 'shot.video-take' THEN '1970-01-01T00:00:00.000Z' ELSE request.`updated_at` END
FROM `__context_first_legacy_request` request
WHERE request.`run_id` = (
	SELECT latest.`run_id`
	FROM `__context_first_legacy_request` latest
	WHERE latest.`spec_id` = request.`spec_id`
	ORDER BY latest.`started_at` DESC, latest.`run_id` DESC
	LIMIT 1
);--> statement-breakpoint

INSERT INTO `media_generation_run` (
	`id`, `spec_id`, `purpose`, `target_kind`, `target_id`, `provider`, `model`,
	`spec_snapshot_json`, `provider_payload_json`, `estimate_json`, `approval_token`,
	`status`, `outputs_json`, `receipt_json`, `diagnostics_json`, `started_at`, `completed_at`
)
SELECT request.`run_id`, request.`spec_id`, request.`purpose`, request.`target_kind`,
	request.`target_id`, request.`provider`, request.`model`,
	json_object(
		'purpose', request.`purpose`,
		'target', json_object('kind', request.`target_kind`, 'id', request.`target_id`),
		'model', json_object('provider', request.`provider`, 'model', request.`model`),
		'values', json(request.`values_json`),
		'references', json(request.`references_json`),
		'title', request.`title`
	),
	request.`provider_payload_json`,
	json_object(
		'provider', request.`provider`,
		'model', request.`model`,
		'estimatedCostUsd', coalesce(json_extract(request.`estimate_snapshot_json`, '$.estimatedCostUsd'), 0),
		'approvalToken', coalesce(
			json_extract(request.`estimate_snapshot_json`, '$.approvalToken'),
			'migrated:' || request.`run_id`
		),
		'billableUnits', json(coalesce(json_extract(request.`estimate_snapshot_json`, '$.billableUnits'), '{}'))
	),
	coalesce(
		json_extract(request.`estimate_snapshot_json`, '$.approvalToken'),
		'migrated:' || request.`run_id`
	),
	CASE WHEN request.`status` IN ('simulated', 'completed', 'failed') THEN request.`status` ELSE 'failed' END,
	request.`outputs_json`, NULL, '[]', request.`started_at`, request.`completed_at`
FROM `__context_first_legacy_request` request;--> statement-breakpoint

INSERT INTO `asset_file_generation` (
	`asset_file_id`, `media_generation_run_id`, `output_artifact_id`, `created_at`
)
SELECT `asset_file_id`, `media_generation_run_id`, `output_artifact_id`, `created_at`
FROM `__context_first_legacy_provenance`;--> statement-breakpoint

INSERT INTO `media_generation_spec` (
	`id`, `purpose`, `target_kind`, `target_id`, `provider`, `model`, `title`,
	`values_json`, `references_json`, `created_at`, `updated_at`
)
SELECT 'media_generation_spec_migrated_' || take.`id`,
	'shot.video-take', 'sceneShotVideoTake', take.`id`, NULL, NULL,
	'Migrated references for ' || take.`title`, '{}',
	coalesce((
		SELECT json_group_array(json(reference.`selection_json`))
		FROM (
			SELECT json_object(
				'id', migrated.`selection_id`,
				'placement', json(
					CASE WHEN migrated.`scope_id` IS NULL AND migrated.`subject_id` IS NULL THEN
						json_object('kind', 'slot', 'sectionId', migrated.`section_id`, 'slotId', migrated.`slot_id`)
					WHEN migrated.`scope_id` IS NULL THEN
						json_object('kind', 'slot', 'sectionId', migrated.`section_id`, 'slotId', migrated.`slot_id`, 'subject', json_object('kind', migrated.`subject_kind`, 'id', migrated.`subject_id`))
					WHEN migrated.`subject_id` IS NULL THEN
						json_object('kind', 'slot', 'sectionId', migrated.`section_id`, 'slotId', migrated.`slot_id`, 'scope', json_object('kind', migrated.`scope_kind`, 'id', migrated.`scope_id`))
					ELSE
						json_object('kind', 'slot', 'sectionId', migrated.`section_id`, 'slotId', migrated.`slot_id`, 'scope', json_object('kind', migrated.`scope_kind`, 'id', migrated.`scope_id`), 'subject', json_object('kind', migrated.`subject_kind`, 'id', migrated.`subject_id`))
					END
				),
				'included', json(CASE WHEN migrated.`included` = 1 THEN 'true' ELSE 'false' END),
				'reference', json_object('kind', 'asset-file', 'assetId', migrated.`asset_id`, 'assetFileId', migrated.`asset_file_id`)
			) AS `selection_json`
			FROM `__context_first_reference` migrated
			WHERE migrated.`take_id` = take.`id`
			ORDER BY migrated.`sort_key`, migrated.`selection_id`
		) reference
	), '[]'), take.`created_at`, take.`updated_at`
FROM `scene_shot_video_take` take
WHERE EXISTS (SELECT 1 FROM `__context_first_reference` migrated WHERE migrated.`take_id` = take.`id`);--> statement-breakpoint

CREATE TEMP TABLE `__context_first_direction_cleanup` (
	`take_id` text NOT NULL,
	`scope_id` text,
	`direction_json` text NOT NULL
);--> statement-breakpoint
INSERT INTO `__context_first_direction_cleanup`
SELECT `id`, NULL, json_extract(`state_json`, '$.structure.sharedDirection')
FROM `scene_shot_video_take`
WHERE json_type(`state_json`, '$.structure.sharedDirection') = 'object';--> statement-breakpoint
INSERT INTO `__context_first_direction_cleanup`
SELECT take.`id`, direction.`key`, direction.`value`
FROM `scene_shot_video_take` take, json_each(take.`state_json`, '$.structure.directionsByShotId') direction;--> statement-breakpoint
UPDATE `__context_first_direction_cleanup`
SET `direction_json` = json_remove(
	`direction_json`,
	'$.referenceSelections',
	'$.cast.characterSheetAssetIds',
	'$.location.environmentSheetAssetIds',
	'$.lookbook.lookbookSheetId',
	'$.referenceImages.customMediaInputIds'
);--> statement-breakpoint
UPDATE `__context_first_direction_cleanup`
SET `direction_json` = json_set(
	`direction_json`,
	'$.dialogue',
	json(coalesce((
		SELECT json_group_array(json(json_remove(
			dialogue.`value`,
			'$.sceneDialogueAudioTakeId',
			'$.assetId',
			'$.assetFileId'
		)))
		FROM json_each(`__context_first_direction_cleanup`.`direction_json`, '$.dialogue') dialogue
	), '[]'))
)
WHERE json_type(`direction_json`, '$.dialogue') = 'array';--> statement-breakpoint
UPDATE `scene_shot_video_take`
SET `state_json` = json_set(
	json_remove(`state_json`, '$.production', '$.promptState'),
	'$.version', 3,
	'$.structure.sharedDirection',
	json((
		SELECT cleanup.`direction_json`
		FROM `__context_first_direction_cleanup` cleanup
		WHERE cleanup.`take_id` = `scene_shot_video_take`.`id` AND cleanup.`scope_id` IS NULL
	))
)
WHERE json_type(`state_json`, '$.structure.sharedDirection') = 'object';--> statement-breakpoint
UPDATE `scene_shot_video_take`
SET `state_json` = json_set(
	json_remove(`state_json`, '$.production', '$.promptState'),
	'$.version', 3,
	'$.structure.directionsByShotId',
	json(coalesce((
		SELECT json_group_object(cleanup.`scope_id`, json(cleanup.`direction_json`))
		FROM `__context_first_direction_cleanup` cleanup
		WHERE cleanup.`take_id` = `scene_shot_video_take`.`id` AND cleanup.`scope_id` IS NOT NULL
	), '{}'))
)
WHERE json_type(`state_json`, '$.structure.directionsByShotId') = 'object';--> statement-breakpoint

DROP TABLE `__context_first_reference`;--> statement-breakpoint
DROP TABLE `__context_first_direction_cleanup`;--> statement-breakpoint
DROP TABLE `__context_first_legacy_request`;--> statement-breakpoint
DROP TABLE `__context_first_legacy_reference`;--> statement-breakpoint
DROP TABLE `__context_first_legacy_provenance`;--> statement-breakpoint
DROP TABLE `__context_first_legacy_run`;--> statement-breakpoint
DROP TABLE `__context_first_legacy_spec`;--> statement-breakpoint
DROP TABLE `__context_first_assert`;--> statement-breakpoint
DROP TABLE `__context_first_direction`;--> statement-breakpoint
PRAGMA user_version = 42;--> statement-breakpoint
PRAGMA foreign_keys=ON;
