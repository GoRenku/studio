-- This is a generated Drizzle migration with a documented custom preservation
-- section. The source schema stores screenplay content across the mandatory
-- Act -> Sequence -> Scene hierarchy and JSON columns, so a table-only rename
-- cannot preserve the populated project.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TEMP TABLE `_screenplay_migration_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint

-- Require the exact source invariants needed for a deterministic conversion.
INSERT INTO `_screenplay_migration_guard` (`valid`)
SELECT CASE WHEN
	(SELECT COUNT(*) FROM `project`) <= 1
	AND (SELECT COUNT(*) FROM `screenplay`) <= (SELECT COUNT(*) FROM `project`)
	AND NOT EXISTS (
		SELECT 1 FROM `project` p CROSS JOIN `screenplay` s
		WHERE trim(p.`title`) = '' OR trim(s.`title`) = ''
			OR p.`title` <> s.`title`
			OR (p.`logline` IS NOT NULL AND s.`logline` IS NOT NULL AND p.`logline` <> s.`logline`)
			OR (p.`summary` IS NOT NULL AND s.`summary` IS NOT NULL AND p.`summary` <> s.`summary`)
	)
	AND NOT EXISTS (
		SELECT 1 FROM `scene` s
		WHERE trim(coalesce(s.`interior_exterior`, '')) = ''
			OR trim(coalesce(s.`time_of_day`, '')) = ''
			OR NOT EXISTS (SELECT 1 FROM `scene_location` sl WHERE sl.`scene_id` = s.`id`)
	)
	AND NOT EXISTS (
		SELECT 1 FROM `scene_location` sl
		LEFT JOIN `location` l ON l.`id` = sl.`location_id`
		WHERE l.`id` IS NULL OR trim(l.`name`) = ''
	)
	AND NOT EXISTS (
		SELECT 1 FROM `scene_production_number` n
		LEFT JOIN `scene` s ON s.`id` = n.`scene_id`
		WHERE s.`id` IS NULL OR trim(n.`production_number`) = ''
	)
	AND (SELECT COUNT(*) FROM `scene_production_number`) = (SELECT COUNT(DISTINCT `scene_id`) FROM `scene_production_number`)
	AND NOT EXISTS (SELECT 1 FROM `asset_membership` WHERE `owner_key` LIKE 'sequence:%')
	AND NOT EXISTS (
		SELECT 1 FROM `cast_design`, json_each(`cast_design`.`document_json`, '$.design.costume.variants') variant
		WHERE json_extract(variant.`value`, '$.scope.kind') = 'sequence'
	)
	AND (SELECT COUNT(*) FROM `screenplay_revision`) = 0
THEN 1 ELSE 0 END;--> statement-breakpoint

CREATE TEMP TABLE `_screenplay_subject` AS
SELECT row_number() OVER (ORDER BY `subject_type`, `handle`, `subject_id`) AS `subject_position`, *
FROM (
	SELECT 'castMember' AS `subject_type`, `id` AS `subject_id`, `handle`, `name` FROM `cast_member`
	UNION ALL
	SELECT 'location' AS `subject_type`, `id` AS `subject_id`, `handle`, `name` FROM `location`
);--> statement-breakpoint
INSERT INTO `_screenplay_migration_guard` (`valid`)
SELECT CASE WHEN NOT EXISTS (
	SELECT 1 FROM `_screenplay_subject`
	GROUP BY `handle`
	HAVING COUNT(*) > 1
) THEN 1 ELSE 0 END;--> statement-breakpoint

CREATE TEMP TABLE `_screenplay_source_block` AS
SELECT s.`id` AS `scene_id`, CAST(block.`key` AS integer) AS `block_index`, block.`value` AS `block_json`
FROM `scene` s, json_each(s.`blocks_json`) block;--> statement-breakpoint
CREATE TEMP TABLE `_screenplay_source_scene` AS
SELECT `id`, `sequence_id`, `position` FROM `scene`;--> statement-breakpoint
INSERT INTO `_screenplay_migration_guard` (`valid`)
SELECT CASE WHEN NOT EXISTS (
	SELECT 1 FROM `_screenplay_source_block`
	WHERE json_type(`block_json`) <> 'object'
		OR json_extract(`block_json`, '$.type') NOT IN (
			'action', 'transition', 'shot', 'lyrics', 'cast_list', 'note',
			'special_heading', 'title_card', 'super', 'dialogue'
		)
		OR (json_extract(`block_json`, '$.type') = 'dialogue' AND (
			trim(coalesce(json_extract(`block_json`, '$.dialogueId'), '')) = ''
			OR trim(coalesce(json_extract(`block_json`, '$.castMemberId'), '')) = ''
			OR json_array_length(json_extract(`block_json`, '$.lines')) = 0
		))
) THEN 1 ELSE 0 END;--> statement-breakpoint

CREATE TEMP TABLE `_screenplay_block_map` AS
SELECT `scene_id`, `block_index`,
	CASE WHEN json_extract(`block_json`, '$.type') = 'dialogue'
		THEN json_extract(`block_json`, '$.dialogueId')
		ELSE 'screenplay_block_' || `scene_id` || '_' || printf('%04d', `block_index`)
	END AS `block_id`
FROM `_screenplay_source_block`;--> statement-breakpoint

-- Normalize every visible old text value through the same handle replacement
-- stream. Dialogue parentheticals precede speech parts, matching their new
-- authored order.
CREATE TEMP TABLE `_screenplay_text_source` AS
SELECT source.`scene_id`, source.`block_index`, 'block' AS `target_kind`,
	map.`block_id` AS `target_id`, NULL AS `turn_id`, NULL AS `part_index`,
	json_extract(source.`block_json`, '$.text') AS `raw_text`
FROM `_screenplay_source_block` source
JOIN `_screenplay_block_map` map USING (`scene_id`, `block_index`)
WHERE json_extract(source.`block_json`, '$.type') <> 'dialogue'
UNION ALL
SELECT source.`scene_id`, source.`block_index`, 'part',
	json_extract(source.`block_json`, '$.dialogueId') || '_part_0000',
	json_extract(source.`block_json`, '$.dialogueId'), 0,
	json_extract(source.`block_json`, '$.parenthetical')
FROM `_screenplay_source_block` source
WHERE json_extract(source.`block_json`, '$.type') = 'dialogue'
	AND json_type(source.`block_json`, '$.parenthetical') = 'text'
UNION ALL
SELECT source.`scene_id`, source.`block_index`, 'part',
	json_extract(source.`block_json`, '$.dialogueId') || '_part_' ||
		printf('%04d', CAST(line.`key` AS integer) +
			CASE WHEN json_type(source.`block_json`, '$.parenthetical') = 'text' THEN 1 ELSE 0 END),
	json_extract(source.`block_json`, '$.dialogueId'),
	CAST(line.`key` AS integer) + CASE WHEN json_type(source.`block_json`, '$.parenthetical') = 'text' THEN 1 ELSE 0 END,
	line.`value`
FROM `_screenplay_source_block` source, json_each(source.`block_json`, '$.lines') line
WHERE json_extract(source.`block_json`, '$.type') = 'dialogue';--> statement-breakpoint

CREATE TEMP TABLE `_screenplay_text_final` AS
WITH RECURSIVE replaced(
	`scene_id`, `block_index`, `target_kind`, `target_id`, `turn_id`, `part_index`, `raw_text`, `text`, `subject_position`
) AS (
	SELECT `scene_id`, `block_index`, `target_kind`, `target_id`, `turn_id`, `part_index`, `raw_text`, `raw_text`, 0
	FROM `_screenplay_text_source`
	UNION ALL
	SELECT replaced.`scene_id`, replaced.`block_index`, replaced.`target_kind`, replaced.`target_id`,
		replaced.`turn_id`, replaced.`part_index`, replaced.`raw_text`,
		replace(replaced.`text`, '@' || subject.`handle`, subject.`name`),
		replaced.`subject_position` + 1
	FROM replaced
	JOIN `_screenplay_subject` subject
		ON subject.`subject_position` = replaced.`subject_position` + 1
)
SELECT `scene_id`, `block_index`, `target_kind`, `target_id`, `turn_id`, `part_index`, `raw_text`, `text`
FROM replaced
WHERE `subject_position` = (SELECT COUNT(*) FROM `_screenplay_subject`);--> statement-breakpoint
INSERT INTO `_screenplay_migration_guard` (`valid`)
SELECT CASE WHEN NOT EXISTS (
	SELECT 1 FROM `_screenplay_text_final` WHERE instr(`text`, '@') > 0 OR `text` IS NULL
) THEN 1 ELSE 0 END;--> statement-breakpoint

-- Every stored parallel subject relationship must name a real subject. A
-- literal handle becomes a mention; a relationship without literal text is
-- deliberately retained later as presence.
INSERT INTO `_screenplay_migration_guard` (`valid`)
SELECT CASE WHEN NOT EXISTS (
	SELECT 1 FROM `_screenplay_source_block` source
	JOIN json_each(source.`block_json`, '$.castMemberIds') member ON true
	LEFT JOIN `cast_member` cast_row ON cast_row.`id` = member.`value`
	WHERE cast_row.`id` IS NULL
	UNION ALL
	SELECT 1 FROM `_screenplay_source_block` source
	JOIN json_each(source.`block_json`, '$.locationIds') location_value ON true
	LEFT JOIN `location` location_row ON location_row.`id` = location_value.`value`
	WHERE location_row.`id` IS NULL
) THEN 1 ELSE 0 END;--> statement-breakpoint

CREATE TEMP TABLE `_screenplay_new_scene` AS
SELECT s.`id`, n.`production_number`,
	trim(s.`interior_exterior`) || '. ' || (
		SELECT group_concat(`name`, ', ') FROM (
			SELECT l.`name` FROM `scene_location` sl
			JOIN `location` l ON l.`id` = sl.`location_id`
			WHERE sl.`scene_id` = s.`id` ORDER BY sl.`position`
		)
	) || ' - ' || trim(s.`time_of_day`) AS `heading`,
	s.`title`,
	(
		SELECT json_group_array(json(`canonical_block`)) FROM (
			SELECT CASE
				WHEN json_extract(source.`block_json`, '$.type') = 'dialogue' THEN json_object(
					'id', map.`block_id`,
					'type', 'dialogue',
					'characterName', cast_row.`name`,
					'extensions', json(CASE
						WHEN json_type(source.`block_json`, '$.extension') = 'text'
						THEN json_array(json_extract(source.`block_json`, '$.extension'))
						ELSE '[]' END),
					'parts', json((
						SELECT json_group_array(json(json_object(
							'id', text_value.`target_id`,
							'type', CASE WHEN text_value.`part_index` = 0
								AND json_type(source.`block_json`, '$.parenthetical') = 'text'
								THEN 'parenthetical' ELSE 'speech' END,
							'text', text_value.`text`
						)))
						FROM `_screenplay_text_final` text_value
						WHERE text_value.`scene_id` = source.`scene_id`
							AND text_value.`block_index` = source.`block_index`
							AND text_value.`target_kind` = 'part'
						ORDER BY text_value.`part_index`
					))
				)
				ELSE json_object(
					'id', map.`block_id`,
					'type', CASE json_extract(source.`block_json`, '$.type')
						WHEN 'cast_list' THEN 'castList'
						WHEN 'special_heading' THEN 'specialHeading'
						WHEN 'title_card' THEN 'titleCard'
						ELSE json_extract(source.`block_json`, '$.type') END,
					'text', text_value.`text`
				)
			END AS `canonical_block`
			FROM `_screenplay_source_block` source
			JOIN `_screenplay_block_map` map USING (`scene_id`, `block_index`)
			LEFT JOIN `cast_member` cast_row
				ON cast_row.`id` = json_extract(source.`block_json`, '$.castMemberId')
			LEFT JOIN `_screenplay_text_final` text_value
				ON text_value.`scene_id` = source.`scene_id`
				AND text_value.`block_index` = source.`block_index`
				AND text_value.`target_kind` = 'block'
			WHERE source.`scene_id` = s.`id`
			ORDER BY source.`block_index`
		)
	) AS `blocks_json`
FROM `scene` s
LEFT JOIN `scene_production_number` n ON n.`scene_id` = s.`id`;--> statement-breakpoint
INSERT INTO `_screenplay_migration_guard` (`valid`)
SELECT CASE WHEN NOT EXISTS (
	SELECT 1 FROM `_screenplay_new_scene`
	WHERE trim(`heading`) = '' OR json_valid(`blocks_json`) = 0
) THEN 1 ELSE 0 END;--> statement-breakpoint

-- Convert hierarchy-independent Screenplay Analysis while the old graph is
-- still available. All creative payloads survive through json_remove/json_set;
-- only organizational IDs, duplicate Scene titles, and the old kind disappear.
INSERT INTO `_screenplay_migration_guard` (`valid`)
SELECT CASE WHEN NOT EXISTS (
	SELECT 1 FROM `screenplay_analysis`
	WHERE json_valid(`document`) = 0
) THEN 1 ELSE 0 END;--> statement-breakpoint
INSERT INTO `_screenplay_migration_guard` (`valid`)
SELECT CASE WHEN NOT EXISTS (
	SELECT 1 FROM `screenplay_analysis` analysis
	WHERE json_extract(analysis.`document`, '$.kind') <> 'screenplayAnalysis'
		OR json_extract(analysis.`document`, '$.structureModel') <> analysis.`structure_model`
		OR json_type(analysis.`document`, '$.acts') <> 'array'
		OR json_type(analysis.`document`, '$.sequences') <> 'array'
		OR json_type(analysis.`document`, '$.scenes') <> 'array'
		OR json_type(analysis.`document`, '$.keyBeats') <> 'array'
		OR json_type(analysis.`document`, '$.suggestedSceneAdditions') <> 'array'
		OR (SELECT json_group_array(json_extract(item.`value`, '$.sceneId'))
			FROM json_each(analysis.`document`, '$.scenes') item)
			<> (SELECT json_group_array(ordered_scene.`id`) FROM (
				SELECT scene_row.`id` FROM `act` act_row
				JOIN `sequence` sequence_row ON sequence_row.`act_id` = act_row.`id`
				JOIN `scene` scene_row ON scene_row.`sequence_id` = sequence_row.`id`
				ORDER BY act_row.`position`, sequence_row.`position`, scene_row.`position`
			) ordered_scene)
		OR (SELECT json_group_array(json_extract(item.`value`, '$.actId'))
			FROM json_each(analysis.`document`, '$.acts') item)
			<> (SELECT json_group_array(ordered_act.`id`) FROM (
				SELECT `id` FROM `act` ORDER BY `position`
			) ordered_act)
		OR (SELECT json_group_array(json_extract(item.`value`, '$.sequenceId'))
			FROM json_each(analysis.`document`, '$.sequences') item)
			<> (SELECT json_group_array(ordered_sequence.`id`) FROM (
				SELECT sequence_row.`id` FROM `act` act_row
				JOIN `sequence` sequence_row ON sequence_row.`act_id` = act_row.`id`
				ORDER BY act_row.`position`, sequence_row.`position`
			) ordered_sequence)
) THEN 1 ELSE 0 END;--> statement-breakpoint
INSERT INTO `_screenplay_migration_guard` (`valid`)
SELECT CASE WHEN NOT EXISTS (
	SELECT 1 FROM `screenplay_analysis` analysis,
		json_each(analysis.`document`, '$.suggestedSceneAdditions') item
	LEFT JOIN `scene` scene_row ON scene_row.`id` = coalesce(
		json_extract(item.`value`, '$.placement.beforeSceneId'),
		json_extract(item.`value`, '$.placement.afterSceneId')
	)
	WHERE (json_type(item.`value`, '$.placement.beforeSceneId') = 'text')
		= (json_type(item.`value`, '$.placement.afterSceneId') = 'text')
		OR scene_row.`id` IS NULL
) THEN 1 ELSE 0 END;--> statement-breakpoint
INSERT INTO `_screenplay_migration_guard` (`valid`)
SELECT CASE WHEN NOT EXISTS (
	SELECT 1 FROM `screenplay_analysis` analysis, json_each(analysis.`document`, '$.scenes') item
	JOIN `scene` scene_row ON scene_row.`id` = json_extract(item.`value`, '$.sceneId')
	JOIN `sequence` sequence_row ON sequence_row.`id` = scene_row.`sequence_id`
	WHERE json_extract(item.`value`, '$.sequenceId') <> sequence_row.`id`
		OR json_extract(item.`value`, '$.actId') <> sequence_row.`act_id`
	UNION ALL
	SELECT 1 FROM `screenplay_analysis` analysis, json_each(analysis.`document`, '$.keyBeats') item
	JOIN `scene` scene_row ON scene_row.`id` = json_extract(item.`value`, '$.sceneId')
	JOIN `sequence` sequence_row ON sequence_row.`id` = scene_row.`sequence_id`
	WHERE json_type(item.`value`, '$.sceneId') = 'text' AND (
		json_extract(item.`value`, '$.sequenceId') <> sequence_row.`id`
		OR json_extract(item.`value`, '$.actId') <> sequence_row.`act_id`
	)
	UNION ALL
	SELECT 1 FROM `screenplay_analysis` analysis,
		json_each(analysis.`document`, '$.suggestedSceneAdditions') item
	JOIN `scene` scene_row ON scene_row.`id` = coalesce(
		json_extract(item.`value`, '$.placement.beforeSceneId'),
		json_extract(item.`value`, '$.placement.afterSceneId')
	)
	JOIN `sequence` sequence_row ON sequence_row.`id` = scene_row.`sequence_id`
	WHERE json_extract(item.`value`, '$.targetSequenceId') <> sequence_row.`id`
		OR json_extract(item.`value`, '$.targetActId') <> sequence_row.`act_id`
	UNION ALL
	SELECT 1 FROM `screenplay_analysis` analysis, json_tree(analysis.`document`) node
	LEFT JOIN `scene` scene_row ON scene_row.`id` = node.`value`
	WHERE node.`key` = 'sceneId' AND scene_row.`id` IS NULL
) THEN 1 ELSE 0 END;--> statement-breakpoint
INSERT INTO `_screenplay_migration_guard` (`valid`)
SELECT CASE WHEN NOT EXISTS (
	SELECT 1 FROM `screenplay_analysis` analysis, json_each(analysis.`document`, '$.scenes') item
	LEFT JOIN `scene` s ON s.`id` = json_extract(item.`value`, '$.sceneId')
	WHERE s.`id` IS NULL OR s.`title` <> json_extract(item.`value`, '$.title')
) THEN 1 ELSE 0 END;--> statement-breakpoint
UPDATE `screenplay_analysis`
SET `document` = json_set(
	json_remove(`document`, '$.kind', '$.acts', '$.sequences', '$.scenes', '$.suggestedSceneAdditions'),
	'$.actSegments', json((
		SELECT json_group_array(json(json_set(
			json_remove(act_item.`value`, '$.actId', '$.actRole'),
			'$.role', json_extract(act_item.`value`, '$.actRole'),
			'$.sceneIds', json((
				SELECT json_group_array(`scene_id`) FROM (
					SELECT scene_row.`id` AS `scene_id`
					FROM `sequence` sequence_row
					JOIN `scene` scene_row ON scene_row.`sequence_id` = sequence_row.`id`
					WHERE sequence_row.`act_id` = json_extract(act_item.`value`, '$.actId')
					ORDER BY sequence_row.`position`, scene_row.`position`
				)
			))
		))) FROM json_each(`document`, '$.acts') act_item
	)),
	'$.sceneGroups', json((
		SELECT json_group_array(json(json_set(
			json_remove(sequence_item.`value`, '$.sequenceId', '$.actId'),
			'$.sceneIds', json((
				SELECT json_group_array(`scene_id`) FROM (
					SELECT scene_row.`id` AS `scene_id` FROM `scene` scene_row
					WHERE scene_row.`sequence_id` = json_extract(sequence_item.`value`, '$.sequenceId')
					ORDER BY scene_row.`position`
				)
			))
		))) FROM json_each(`document`, '$.sequences') sequence_item
	)),
	'$.keyBeats', json((
		SELECT json_group_array(json(json_remove(beat_item.`value`, '$.actId', '$.sequenceId')))
		FROM json_each(`document`, '$.keyBeats') beat_item
	)),
	'$.sceneAnalyses', json((
		SELECT json_group_array(json(json_remove(scene_item.`value`, '$.actId', '$.sequenceId', '$.title')))
		FROM json_each(`document`, '$.scenes') scene_item
	)),
	'$.suggestedScenes', json((
		SELECT json_group_array(json(json_remove(suggestion_item.`value`, '$.targetActId', '$.targetSequenceId')))
		FROM json_each(`document`, '$.suggestedSceneAdditions') suggestion_item
	))
);--> statement-breakpoint
INSERT INTO `_screenplay_migration_guard` (`valid`)
SELECT CASE WHEN NOT EXISTS (
	SELECT 1 FROM `screenplay_analysis`
	WHERE json_valid(`document`) = 0
		OR json_type(`document`, '$.kind') IS NOT NULL
		OR json_type(`document`, '$.acts') IS NOT NULL
		OR json_type(`document`, '$.sequences') IS NOT NULL
		OR json_type(`document`, '$.scenes') IS NOT NULL
		OR json_type(`document`, '$.suggestedSceneAdditions') IS NOT NULL
		OR json_type(`document`, '$.actSegments') <> 'array'
		OR json_type(`document`, '$.sceneGroups') <> 'array'
		OR json_type(`document`, '$.sceneAnalyses') <> 'array'
		OR json_type(`document`, '$.suggestedScenes') <> 'array'
) THEN 1 ELSE 0 END;--> statement-breakpoint

-- Move the single metadata owner onto Project. Existing nullable Project
-- aspect ratio means the accepted historical effective default, 16:9.
CREATE TABLE `__new_project` (
	`id` text PRIMARY KEY NOT NULL,
	`project_name` text NOT NULL,
	`title` text NOT NULL,
	`aspect_ratio` text NOT NULL,
	`cover_file` text,
	`logline` text,
	`synopsis` text,
	`premise` text,
	`intended_audience` text,
	`format` text,
	`target_runtime_minutes` integer,
	`primary_genre` text,
	`secondary_genres_json` text,
	`tones_json` text,
	`content_rating_intent` text,
	`creative_boundaries_json` text,
	`central_conflict` text,
	`dramatic_question` text,
	`themes_json` text,
	`historical_basis_json` text,
	`dramatized_elements_json` text,
	`screenplay_draft_status` text,
	`research_sources_json` text,
	`assumptions_json` text,
	`open_questions_json` text,
	`next_steps_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `project_project_name_non_empty_check` CHECK(length(`project_name`) > 0),
	CONSTRAINT `project_title_non_empty_check` CHECK(length(`title`) > 0),
	CONSTRAINT `project_aspect_ratio_non_empty_check` CHECK(length(`aspect_ratio`) > 0),
	CONSTRAINT `project_runtime_non_negative_check` CHECK(`target_runtime_minutes` is null or `target_runtime_minutes` >= 0),
	CONSTRAINT `project_cover_file_check` CHECK(`cover_file` is null or `cover_file` = 'cover.png')
);--> statement-breakpoint
INSERT INTO `__new_project`
SELECT p.`id`, p.`name`, p.`title`, coalesce(nullif(trim(p.`aspect_ratio`), ''), '16:9'), p.`cover_file`,
	coalesce(p.`logline`, s.`logline`), coalesce(p.`summary`, s.`summary`), s.`premise_overview`,
	s.`intended_audience`,
	CASE WHEN s.`target_length_label` = '10-minute short film' THEN 'short film' ELSE s.`target_length_label` END,
	s.`estimated_minutes`, s.`genre_primary`, s.`genre_secondary`, s.`tone`, s.`rating_intent`, s.`boundaries`,
	s.`central_conflict`, s.`dramatic_question`, s.`themes`, s.`historical_basis`, s.`dramatized_elements`,
	s.`status`, s.`research_sources`,
	CASE WHEN s.`assumptions_made` IS NULL THEN NULL ELSE (
		SELECT CASE WHEN COUNT(*) = 0 THEN NULL ELSE json_group_array(`value`) END
		FROM json_each(s.`assumptions_made`)
		WHERE `value` NOT LIKE 'Open question:%' AND `value` NOT LIKE 'Next iteration option:%'
	) END,
	CASE WHEN s.`assumptions_made` IS NULL THEN NULL ELSE (
		SELECT CASE WHEN COUNT(*) = 0 THEN NULL ELSE json_group_array(trim(substr(`value`, length('Open question:') + 1))) END
		FROM json_each(s.`assumptions_made`) WHERE `value` LIKE 'Open question:%'
	) END,
	CASE WHEN s.`assumptions_made` IS NULL THEN NULL ELSE (
		SELECT CASE WHEN COUNT(*) = 0 THEN NULL ELSE json_group_array(trim(substr(`value`, length('Next iteration option:') + 1))) END
		FROM json_each(s.`assumptions_made`) WHERE `value` LIKE 'Next iteration option:%'
	) END,
	p.`created_at`, p.`updated_at`
FROM `project` p LEFT JOIN `screenplay` s ON true;--> statement-breakpoint
DROP TABLE `project`;--> statement-breakpoint
ALTER TABLE `__new_project` RENAME TO `project`;--> statement-breakpoint
CREATE UNIQUE INDEX `project_project_name_unique_idx` ON `project` (`project_name`);--> statement-breakpoint

-- Resolve Beat evidence before replacing Scene. Then stage every table whose
-- foreign key points at Scene (or Dialogue Audio) so the migration remains
-- valid when Drizzle runs it in one transaction with foreign keys enabled.
UPDATE `scene_beat_sheet`
SET `document` = json_set(
	CASE
		WHEN json_type(`document`, '$.openQuestions') = 'array'
			AND json_array_length(`document`, '$.openQuestions') = 0
		THEN json_remove(`document`, '$.kind', '$.beats', '$.openQuestions')
		ELSE json_remove(`document`, '$.kind', '$.beats')
	END,
	'$.beats', json((
		SELECT json_group_array(json(json_set(
			json_remove(beat.`value`, '$.screenplayBlockIndexes'),
			'$.propIds', json('[]'),
			'$.screenplayBlockIds', json((
				SELECT json_group_array(map.`block_id`)
				FROM json_each(beat.`value`, '$.screenplayBlockIndexes') old_index
				JOIN `_screenplay_block_map` map
					ON map.`scene_id` = `scene_beat_sheet`.`scene_id`
					AND map.`block_index` = CAST(old_index.`value` AS integer)
			))
		))) FROM json_each(`document`, '$.beats') beat
	))
);--> statement-breakpoint
CREATE TEMP TABLE `_scene_location_source` AS SELECT * FROM `scene_location`;--> statement-breakpoint
CREATE TEMP TABLE `_scene_beat_sheet_source` AS SELECT * FROM `scene_beat_sheet`;--> statement-breakpoint
CREATE TEMP TABLE `_scene_beat_sheet_state_source` AS SELECT * FROM `scene_beat_sheet_state`;--> statement-breakpoint
CREATE TEMP TABLE `_scene_dialogue_audio_source` AS SELECT * FROM `scene_dialogue_audio`;--> statement-breakpoint
CREATE TEMP TABLE `_scene_dialogue_audio_take_source` AS SELECT * FROM `scene_dialogue_audio_take`;--> statement-breakpoint
DROP TABLE `scene_beat_sheet_state`;--> statement-breakpoint
DROP TABLE `scene_beat_sheet`;--> statement-breakpoint
DROP TABLE `scene_dialogue_audio_take`;--> statement-breakpoint
DROP TABLE `scene_dialogue_audio`;--> statement-breakpoint
DROP TABLE `scene_location`;--> statement-breakpoint

-- Replace Scene rows only after all converted JSON has been materialized.
CREATE TABLE `__new_scene` (
	`id` text PRIMARY KEY NOT NULL,
	`production_number` text,
	`heading` text NOT NULL,
	`title` text,
	`blocks_json` text DEFAULT '[]' NOT NULL,
	CONSTRAINT `scene_heading_non_empty_check` CHECK(length(`heading`) > 0),
	CONSTRAINT `scene_production_number_non_empty_check` CHECK(`production_number` is null or length(`production_number`) > 0)
);--> statement-breakpoint
INSERT INTO `__new_scene` SELECT `id`, `production_number`, `heading`, `title`, `blocks_json` FROM `_screenplay_new_scene`;--> statement-breakpoint
DROP TABLE `scene`;--> statement-breakpoint
ALTER TABLE `__new_scene` RENAME TO `scene`;--> statement-breakpoint
CREATE UNIQUE INDEX `scene_production_number_unique_idx` ON `scene` (`production_number`) WHERE `production_number` is not null;--> statement-breakpoint

CREATE TABLE `scene_beat_sheet` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`title` text NOT NULL,
	`document` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `scene_beat_sheet` SELECT * FROM `_scene_beat_sheet_source`;--> statement-breakpoint
CREATE INDEX `scene_beat_sheet_scene_updated_idx` ON `scene_beat_sheet` (`scene_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE TABLE `scene_beat_sheet_state` (
	`scene_id` text PRIMARY KEY NOT NULL,
	`active_beat_sheet_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`active_beat_sheet_id`) REFERENCES `scene_beat_sheet`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `scene_beat_sheet_state` SELECT * FROM `_scene_beat_sheet_state_source`;--> statement-breakpoint

CREATE TABLE `scene_dialogue_audio` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`turn_id` text NOT NULL,
	`cast_member_id` text NOT NULL,
	`cast_voice_id` text,
	`model_choice` text NOT NULL,
	`plain_text` text NOT NULL,
	`v3_text` text NOT NULL,
	`voice_settings_json` text NOT NULL,
	`output_format` text NOT NULL,
	`language_code` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cast_voice_id`) REFERENCES `cast_voice`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `scene_dialogue_audio` SELECT * FROM `_scene_dialogue_audio_source`;--> statement-breakpoint
CREATE INDEX `scene_dialogue_audio_scene_idx` ON `scene_dialogue_audio` (`scene_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scene_dialogue_audio_turn_idx` ON `scene_dialogue_audio` (`scene_id`,`turn_id`);--> statement-breakpoint
CREATE INDEX `scene_dialogue_audio_cast_member_idx` ON `scene_dialogue_audio` (`cast_member_id`);--> statement-breakpoint
CREATE INDEX `scene_dialogue_audio_cast_voice_idx` ON `scene_dialogue_audio` (`cast_voice_id`);--> statement-breakpoint
CREATE TABLE `scene_dialogue_audio_take` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_dialogue_audio_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`asset_file_id` text NOT NULL,
	`model_choice` text NOT NULL,
	`cast_voice_id` text NOT NULL,
	`cast_voice_name` text NOT NULL,
	`provider` text NOT NULL,
	`provider_voice_id` text NOT NULL,
	`provider_text_snapshot` text NOT NULL,
	`plain_text_snapshot` text NOT NULL,
	`v3_text_snapshot` text NOT NULL,
	`text_treatment` text NOT NULL,
	`voice_settings_snapshot_json` text NOT NULL,
	`output_format` text NOT NULL,
	`language_code` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`scene_dialogue_audio_id`) REFERENCES `scene_dialogue_audio`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cast_voice_id`) REFERENCES `cast_voice`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `scene_dialogue_audio_take` SELECT * FROM `_scene_dialogue_audio_take_source`;--> statement-breakpoint
CREATE INDEX `scene_dialogue_audio_take_audio_idx` ON `scene_dialogue_audio_take` (`scene_dialogue_audio_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scene_dialogue_audio_take_asset_idx` ON `scene_dialogue_audio_take` (`asset_id`);--> statement-breakpoint

CREATE TABLE `screenplay_section` (
	`id` text PRIMARY KEY NOT NULL,
	`section_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	CONSTRAINT `screenplay_section_type_check` CHECK(`section_type` in ('act', 'sequence')),
	CONSTRAINT `screenplay_section_title_non_empty_check` CHECK(length(`title`) > 0)
);--> statement-breakpoint
INSERT INTO `screenplay_section`
SELECT `id`, 'act', `title`, `purpose` FROM `act`
UNION ALL
SELECT `id`, 'sequence', `title`, `purpose` FROM `sequence`;--> statement-breakpoint

CREATE TABLE `screenplay_structure_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_section_id` text,
	`content_type` text NOT NULL,
	`scene_id` text,
	`section_id` text,
	`position` integer NOT NULL,
	FOREIGN KEY (`parent_section_id`) REFERENCES `screenplay_section`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `screenplay_section`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `screenplay_structure_content_check` CHECK((`content_type` = 'scene' and `scene_id` is not null and `section_id` is null) or (`content_type` = 'section' and `scene_id` is null and `section_id` is not null)),
	CONSTRAINT `screenplay_structure_position_non_negative_check` CHECK(`position` >= 0)
);--> statement-breakpoint
INSERT INTO `screenplay_structure_entry`
SELECT 'screenplay_structure_act_' || `id`, NULL, 'section', NULL, `id`, `position` FROM `act`
UNION ALL
SELECT 'screenplay_structure_sequence_' || `id`, `act_id`, 'section', NULL, `id`, `position` FROM `sequence`
UNION ALL
SELECT 'screenplay_structure_scene_' || `id`, `sequence_id`, 'scene', `id`, NULL, `position`
FROM `_screenplay_source_scene`;--> statement-breakpoint
CREATE UNIQUE INDEX `screenplay_structure_scene_unique_idx` ON `screenplay_structure_entry` (`scene_id`) WHERE `scene_id` is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `screenplay_structure_section_unique_idx` ON `screenplay_structure_entry` (`section_id`) WHERE `section_id` is not null;--> statement-breakpoint
CREATE UNIQUE INDEX `screenplay_structure_root_position_unique_idx` ON `screenplay_structure_entry` (`position`) WHERE `parent_section_id` is null;--> statement-breakpoint
CREATE UNIQUE INDEX `screenplay_structure_parent_position_unique_idx` ON `screenplay_structure_entry` (`parent_section_id`,`position`) WHERE `parent_section_id` is not null;--> statement-breakpoint
CREATE INDEX `screenplay_structure_parent_position_idx` ON `screenplay_structure_entry` (`parent_section_id`,`position`,`id`);--> statement-breakpoint

CREATE TABLE `screenplay_reference` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`cast_member_id` text,
	`location_id` text,
	`prop_id` text,
	`target_type` text NOT NULL,
	`opening_element_id` text,
	`scene_id` text,
	`block_id` text,
	`turn_id` text,
	`part_id` text,
	`role` text NOT NULL,
	`range_start` integer,
	`range_length` integer,
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prop_id`) REFERENCES `prop`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `screenplay_reference_subject_check` CHECK((`subject_type` = 'castMember' and `cast_member_id` is not null and `location_id` is null and `prop_id` is null) or (`subject_type` = 'location' and `cast_member_id` is null and `location_id` is not null and `prop_id` is null) or (`subject_type` = 'prop' and `cast_member_id` is null and `location_id` is null and `prop_id` is not null)),
	CONSTRAINT `screenplay_reference_target_check` CHECK((`target_type` = 'openingElement' and `opening_element_id` is not null and `scene_id` is null and `block_id` is null and `turn_id` is null and `part_id` is null) or (`target_type` in ('scene', 'sceneHeading') and `opening_element_id` is null and `scene_id` is not null and `block_id` is null and `turn_id` is null and `part_id` is null) or (`target_type` = 'block' and `opening_element_id` is null and `scene_id` is not null and `block_id` is not null and `turn_id` is null and `part_id` is null) or (`target_type` = 'dialogueCue' and `opening_element_id` is null and `scene_id` is not null and `block_id` is null and `turn_id` is not null and `part_id` is null) or (`target_type` = 'dialoguePart' and `opening_element_id` is null and `scene_id` is not null and `block_id` is null and `turn_id` is not null and `part_id` is not null)),
	CONSTRAINT `screenplay_reference_role_check` CHECK(`role` in ('speaker', 'setting', 'mention', 'presence')),
	CONSTRAINT `screenplay_reference_range_check` CHECK((`role` = 'mention' and `range_start` is not null and `range_start` >= 0 and `range_length` is not null and `range_length` > 0) or (`role` <> 'mention' and `range_start` is null and `range_length` is null))
);--> statement-breakpoint

-- A recognized literal handle must agree with the old relationship arrays and
-- must occur only once in that exact text target, so range derivation is exact.
INSERT INTO `_screenplay_migration_guard` (`valid`)
SELECT CASE WHEN NOT EXISTS (
	SELECT 1
	FROM `_screenplay_text_source` text_source
	JOIN `_screenplay_source_block` source USING (`scene_id`, `block_index`)
	JOIN `_screenplay_subject` subject
		ON instr(text_source.`raw_text`, '@' || subject.`handle`) > 0
	WHERE (
		subject.`subject_type` = 'castMember'
		AND NOT EXISTS (
			SELECT 1 FROM json_each(source.`block_json`, '$.castMemberIds') member
			WHERE member.`value` = subject.`subject_id`
		)
	) OR (
		subject.`subject_type` = 'location'
		AND NOT EXISTS (
			SELECT 1 FROM json_each(source.`block_json`, '$.locationIds') location_value
			WHERE location_value.`value` = subject.`subject_id`
		)
	) OR instr(
		substr(text_source.`raw_text`, instr(text_source.`raw_text`, '@' || subject.`handle`) + length('@' || subject.`handle`)),
		'@' || subject.`handle`
	) > 0
) THEN 1 ELSE 0 END;--> statement-breakpoint

-- Speaker bindings keep each old dialogue ID as the new Dialogue Turn ID.
INSERT INTO `screenplay_reference` (
	`id`, `subject_type`, `cast_member_id`, `location_id`, `prop_id`,
	`target_type`, `opening_element_id`, `scene_id`, `block_id`, `turn_id`, `part_id`,
	`role`, `range_start`, `range_length`
)
SELECT 'screenplay_reference_speaker_' || json_extract(source.`block_json`, '$.dialogueId'),
	'castMember', json_extract(source.`block_json`, '$.castMemberId'), NULL, NULL,
	'dialogueCue', NULL, source.`scene_id`, NULL,
	json_extract(source.`block_json`, '$.dialogueId'), NULL, 'speaker', NULL, NULL
FROM `_screenplay_source_block` source
WHERE json_extract(source.`block_json`, '$.type') = 'dialogue';--> statement-breakpoint

-- Exact text mentions point either at a Text Block or a Dialogue Part.
INSERT INTO `screenplay_reference` (
	`id`, `subject_type`, `cast_member_id`, `location_id`, `prop_id`,
	`target_type`, `opening_element_id`, `scene_id`, `block_id`, `turn_id`, `part_id`,
	`role`, `range_start`, `range_length`
)
SELECT 'screenplay_reference_mention_' || text_value.`scene_id` || '_' || text_value.`block_index` || '_' ||
	text_value.`target_id` || '_' || subject.`subject_type` || '_' || subject.`subject_id`,
	subject.`subject_type`,
	CASE WHEN subject.`subject_type` = 'castMember' THEN subject.`subject_id` END,
	CASE WHEN subject.`subject_type` = 'location' THEN subject.`subject_id` END,
	NULL,
	CASE WHEN text_value.`target_kind` = 'block' THEN 'block' ELSE 'dialoguePart' END,
	NULL, text_value.`scene_id`,
	CASE WHEN text_value.`target_kind` = 'block' THEN text_value.`target_id` END,
	CASE WHEN text_value.`target_kind` = 'part' THEN text_value.`turn_id` END,
	CASE WHEN text_value.`target_kind` = 'part' THEN text_value.`target_id` END,
	'mention', instr(text_value.`text`, subject.`name`) - 1, length(subject.`name`)
FROM `_screenplay_text_final` text_value
JOIN `_screenplay_subject` subject
	ON instr(text_value.`raw_text`, '@' || subject.`handle`) > 0;--> statement-breakpoint

-- Retain explicit old block relationships that had no literal token as
-- unanchored presence instead of inventing prose or a fake range.
INSERT INTO `screenplay_reference` (
	`id`, `subject_type`, `cast_member_id`, `location_id`, `prop_id`,
	`target_type`, `opening_element_id`, `scene_id`, `block_id`, `turn_id`, `part_id`,
	`role`, `range_start`, `range_length`
)
SELECT 'screenplay_reference_presence_cast_' || source.`scene_id` || '_' || source.`block_index` || '_' || member.`value`,
	'castMember', member.`value`, NULL, NULL, 'block', NULL, source.`scene_id`, map.`block_id`, NULL, NULL,
	'presence', NULL, NULL
FROM `_screenplay_source_block` source
JOIN `_screenplay_block_map` map USING (`scene_id`, `block_index`),
	json_each(source.`block_json`, '$.castMemberIds') member
WHERE NOT EXISTS (
	SELECT 1 FROM `_screenplay_text_source` text_source
	JOIN `cast_member` cast_row ON cast_row.`id` = member.`value`
	WHERE text_source.`scene_id` = source.`scene_id`
		AND text_source.`block_index` = source.`block_index`
		AND instr(text_source.`raw_text`, '@' || cast_row.`handle`) > 0
)
UNION ALL
SELECT 'screenplay_reference_presence_location_' || source.`scene_id` || '_' || source.`block_index` || '_' || location_value.`value`,
	'location', NULL, location_value.`value`, NULL, 'block', NULL, source.`scene_id`, map.`block_id`, NULL, NULL,
	'presence', NULL, NULL
FROM `_screenplay_source_block` source
JOIN `_screenplay_block_map` map USING (`scene_id`, `block_index`),
	json_each(source.`block_json`, '$.locationIds') location_value
WHERE NOT EXISTS (
	SELECT 1 FROM `_screenplay_text_source` text_source
	JOIN `location` location_row ON location_row.`id` = location_value.`value`
	WHERE text_source.`scene_id` = source.`scene_id`
		AND text_source.`block_index` = source.`block_index`
		AND instr(text_source.`raw_text`, '@' || location_row.`handle`) > 0
);--> statement-breakpoint

-- Scene setting and heading mentions preserve the old ordered Scene Location
-- relationship and every displayed Location label.
INSERT INTO `screenplay_reference` (
	`id`, `subject_type`, `cast_member_id`, `location_id`, `prop_id`,
	`target_type`, `opening_element_id`, `scene_id`, `block_id`, `turn_id`, `part_id`,
	`role`, `range_start`, `range_length`
)
SELECT 'screenplay_reference_setting_' || sl.`scene_id` || '_' || sl.`location_id`,
	'location', NULL, sl.`location_id`, NULL, 'scene', NULL, sl.`scene_id`, NULL, NULL, NULL,
	'setting', NULL, NULL
FROM `_scene_location_source` sl
UNION ALL
SELECT 'screenplay_reference_heading_' || sl.`scene_id` || '_' || sl.`location_id`,
	'location', NULL, sl.`location_id`, NULL, 'sceneHeading', NULL, sl.`scene_id`, NULL, NULL, NULL,
	'mention', instr(scene_row.`heading`, location_row.`name`) - 1, length(location_row.`name`)
FROM `_scene_location_source` sl
JOIN `location` location_row ON location_row.`id` = sl.`location_id`
JOIN `scene` scene_row ON scene_row.`id` = sl.`scene_id`;--> statement-breakpoint

CREATE INDEX `screenplay_reference_scene_idx` ON `screenplay_reference` (`scene_id`,`id`);--> statement-breakpoint
CREATE INDEX `screenplay_reference_cast_idx` ON `screenplay_reference` (`cast_member_id`,`id`);--> statement-breakpoint
CREATE INDEX `screenplay_reference_location_idx` ON `screenplay_reference` (`location_id`,`id`);--> statement-breakpoint
CREATE INDEX `screenplay_reference_prop_idx` ON `screenplay_reference` (`prop_id`,`id`);--> statement-breakpoint

-- Scene-scoped costume variants become explicit one-Scene sets. The real
-- project currently contains only Project-wide variants; this conversion also
-- handles valid Scene scopes without a compatibility reader.
UPDATE `cast_design`
SET `document_json` = json_set(
	`document_json`,
	'$.design.costume.variants',
	json((
		SELECT json_group_array(json(CASE
			WHEN json_extract(variant.`value`, '$.scope.kind') = 'scene'
			THEN json_set(
				json_remove(variant.`value`, '$.scope'),
				'$.scope', json_object(
					'kind', 'scenes',
					'sceneIds', json_array(json_extract(variant.`value`, '$.scope.sceneId'))
				)
			)
			ELSE variant.`value`
		END))
		FROM json_each(`document_json`, '$.design.costume.variants') variant
	))
)
WHERE json_type(`document_json`, '$.design.costume.variants') = 'array';--> statement-breakpoint

CREATE TABLE `__new_screenplay_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`screenplay_json` text NOT NULL,
	`source_command` text NOT NULL,
	`summary` text,
	`created_at` text NOT NULL,
	CONSTRAINT `screenplay_revision_source_non_empty_check` CHECK(length(`source_command`) > 0)
);--> statement-breakpoint
DROP TABLE `screenplay_revision`;--> statement-breakpoint
ALTER TABLE `__new_screenplay_revision` RENAME TO `screenplay_revision`;--> statement-breakpoint
CREATE INDEX `screenplay_revision_created_idx` ON `screenplay_revision` (`created_at`,`id`);--> statement-breakpoint

CREATE TABLE `__new_screenplay` (
	`singleton_id` integer PRIMARY KEY NOT NULL,
	`opening_json` text DEFAULT '[]' NOT NULL,
	CONSTRAINT `screenplay_singleton_check` CHECK(`singleton_id` = 1)
);--> statement-breakpoint
INSERT INTO `__new_screenplay` (`singleton_id`, `opening_json`)
SELECT 1, '[]' WHERE EXISTS (SELECT 1 FROM `project`);--> statement-breakpoint
DROP TABLE `screenplay`;--> statement-breakpoint
ALTER TABLE `__new_screenplay` RENAME TO `screenplay`;--> statement-breakpoint

DROP TABLE `scene_production_number`;--> statement-breakpoint
DROP TABLE `sequence`;--> statement-breakpoint
DROP TABLE `act`;--> statement-breakpoint

DROP TABLE `_screenplay_new_scene`;--> statement-breakpoint
DROP TABLE `_screenplay_text_final`;--> statement-breakpoint
DROP TABLE `_screenplay_text_source`;--> statement-breakpoint
DROP TABLE `_screenplay_block_map`;--> statement-breakpoint
DROP TABLE `_screenplay_source_block`;--> statement-breakpoint
DROP TABLE `_screenplay_source_scene`;--> statement-breakpoint
DROP TABLE `_screenplay_subject`;--> statement-breakpoint
DROP TABLE `_scene_dialogue_audio_take_source`;--> statement-breakpoint
DROP TABLE `_scene_dialogue_audio_source`;--> statement-breakpoint
DROP TABLE `_scene_beat_sheet_state_source`;--> statement-breakpoint
DROP TABLE `_scene_beat_sheet_source`;--> statement-breakpoint
DROP TABLE `_scene_location_source`;--> statement-breakpoint
DROP TABLE `_screenplay_migration_guard`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA user_version = 57;
