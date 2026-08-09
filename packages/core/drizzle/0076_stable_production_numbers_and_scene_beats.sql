-- Drizzle Kit generated the schema rename and table additions from the 0075
-- snapshot. The focused custom statements preserve populated Scene Beats JSON
-- revisions and backfill required Shot Plan/Shot numbers that Drizzle cannot
-- derive from the schema diff alone.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TEMP TABLE `_migration_0076_screenplay_structure_scene` AS
SELECT * FROM `screenplay_structure_entry` WHERE `scene_id` IS NOT NULL;--> statement-breakpoint
CREATE TEMP TABLE `_migration_0076_screenplay_reference_scene` AS
SELECT * FROM `screenplay_reference` WHERE `scene_id` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `__new_scene` (
	`id` text PRIMARY KEY NOT NULL,
	`production_number` text,
	`heading` text NOT NULL,
	`title` text,
	`blocks_json` text DEFAULT '[]' NOT NULL,
	CONSTRAINT "scene_heading_non_empty_check" CHECK(length("__new_scene"."heading") > 0)
);--> statement-breakpoint
INSERT INTO `__new_scene`("id", "production_number", "heading", "title", "blocks_json") SELECT "id", "production_number", "heading", "title", "blocks_json" FROM `scene`;--> statement-breakpoint
DROP TABLE `scene`;--> statement-breakpoint
ALTER TABLE `__new_scene` RENAME TO `scene`;--> statement-breakpoint
INSERT OR IGNORE INTO `screenplay_structure_entry`
SELECT * FROM `_migration_0076_screenplay_structure_scene`;--> statement-breakpoint
INSERT OR IGNORE INTO `screenplay_reference`
SELECT * FROM `_migration_0076_screenplay_reference_scene`;--> statement-breakpoint
DROP TABLE `_migration_0076_screenplay_structure_scene`;--> statement-breakpoint
DROP TABLE `_migration_0076_screenplay_reference_scene`;--> statement-breakpoint

ALTER TABLE `scene_beat_sheet` RENAME TO `scene_beats_revision`;--> statement-breakpoint
ALTER TABLE `scene_beat_sheet_state` RENAME TO `scene_beats_state`;--> statement-breakpoint
ALTER TABLE `scene_beats_state` RENAME COLUMN "active_beat_sheet_id" TO "active_revision_id";--> statement-breakpoint

CREATE TABLE `agent_scene_number_reservation` (
	`number` text NOT NULL,
	`number_key` text NOT NULL,
	`scene_id` text NOT NULL,
	`created_at` text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_scene_number_key_unique_idx` ON `agent_scene_number_reservation` (`number_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_scene_number_scene_unique_idx` ON `agent_scene_number_reservation` (`scene_id`);--> statement-breakpoint

DROP INDEX `scene_beat_sheet_scene_updated_idx`;--> statement-breakpoint
CREATE INDEX `scene_beats_revision_scene_updated_idx` ON `scene_beats_revision` (`scene_id`,`updated_at`,`id`);--> statement-breakpoint

UPDATE `scene_beats_revision`
SET `document` = json_patch(
	json_object(
		'sceneBeats', json_object(
			'sceneId', `scene_id`,
			'beats', json(COALESCE((
				SELECT json_group_array(
					json_set(beat.`value`, '$.number', CAST(beat.`key` + 1 AS text))
				)
				FROM json_each(`scene_beats_revision`.`document`, '$.beats') beat
			), '[]'))
		),
		'reservedNumbers', json(COALESCE((
			SELECT json_group_array(CAST(beat.`key` + 1 AS text))
			FROM json_each(`scene_beats_revision`.`document`, '$.beats') beat
		), '[]'))
	),
	CASE
		WHEN json_type(`document`, '$.baseBeatSheetId') = 'text'
		THEN json_object('baseRevisionId', json_extract(`document`, '$.baseBeatSheetId'))
		ELSE json('{}')
	END
);--> statement-breakpoint
ALTER TABLE `scene_beats_revision` DROP COLUMN `title`;--> statement-breakpoint

UPDATE `project_settings`
SET `document` = json_set(
	json_remove(`document`, '$.screenplayImport.generateSceneBeatSheets'),
	'$.version', 2,
	'$.screenplayImport.generateSceneBeats',
	CASE json_type(`document`, '$.screenplayImport.generateSceneBeatSheets')
		WHEN 'true' THEN json('true')
		ELSE json('false')
	END
);--> statement-breakpoint

UPDATE `shot_plan`
SET `coverage` = json_set(
	json_remove(`coverage`, '$.beatSheetId'),
	'$.sceneBeatsRevisionId', json_extract(`coverage`, '$.beatSheetId')
)
WHERE `coverage` IS NOT NULL
	AND json_type(`coverage`, '$.beatSheetId') = 'text';--> statement-breakpoint

CREATE TEMP TABLE `_migration_0076_shot` AS SELECT * FROM `shot`;--> statement-breakpoint
DROP TABLE `shot`;--> statement-breakpoint

CREATE TABLE `__new_shot_plan` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`coverage` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	CONSTRAINT "shot_plan_number_positive_check" CHECK("__new_shot_plan"."number" > 0)
);--> statement-breakpoint
INSERT INTO `__new_shot_plan`
SELECT
	`id`,
	`scene_id`,
	row_number() OVER (PARTITION BY `scene_id` ORDER BY `created_at`, `id`),
	`title`,
	`coverage`,
	`created_at`,
	`updated_at`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
FROM `shot_plan`;--> statement-breakpoint
DROP TABLE `shot_plan`;--> statement-breakpoint
ALTER TABLE `__new_shot_plan` RENAME TO `shot_plan`;--> statement-breakpoint
CREATE INDEX `shot_plan_scene_active_created_idx` ON `shot_plan` (`scene_id`,`discarded_at`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_scene_number_unique_idx` ON `shot_plan` (`scene_id`,`number`);--> statement-breakpoint

CREATE TABLE `shot` (
	`id` text PRIMARY KEY NOT NULL,
	`shot_plan_id` text NOT NULL,
	`position` integer NOT NULL,
	`number` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`brief` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`shot_plan_id`) REFERENCES `shot_plan`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "shot_position_non_negative_check" CHECK("shot"."position" >= 0)
);--> statement-breakpoint
INSERT INTO `shot`
SELECT
	`id`,
	`shot_plan_id`,
	`position`,
	CAST(row_number() OVER (
		PARTITION BY `shot_plan_id`
		ORDER BY `position`, `created_at`, `id`
	) AS text),
	`title`,
	`description`,
	`brief`,
	`created_at`,
	`updated_at`,
	`discarded_at`,
	`discard_operation_id`,
	`restored_at`
FROM `_migration_0076_shot`;--> statement-breakpoint
DROP TABLE `_migration_0076_shot`;--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_position_unique_idx` ON `shot` (`shot_plan_id`,`position`);--> statement-breakpoint
CREATE INDEX `shot_plan_id_idx` ON `shot` (`shot_plan_id`,`id`);--> statement-breakpoint

CREATE TABLE `scene_shot_plan_number` (
	`scene_id` text PRIMARY KEY NOT NULL,
	`last_number` integer NOT NULL,
	CONSTRAINT "scene_shot_plan_last_number_non_negative_check" CHECK("scene_shot_plan_number"."last_number" >= 0)
);--> statement-breakpoint
INSERT INTO `scene_shot_plan_number`
SELECT `scene_id`, max(`number`) FROM `shot_plan` GROUP BY `scene_id`;--> statement-breakpoint

CREATE TABLE `shot_number_reservation` (
	`shot_plan_id` text NOT NULL,
	`number` text NOT NULL,
	`number_key` text NOT NULL,
	`shot_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`shot_plan_id`) REFERENCES `shot_plan`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `shot_number_reservation`
SELECT `shot_plan_id`, `number`, lower(`number`), `id`, `created_at` FROM `shot`;--> statement-breakpoint
CREATE UNIQUE INDEX `shot_number_reservation_scope_number_unique_idx` ON `shot_number_reservation` (`shot_plan_id`,`number_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `shot_number_reservation_scope_shot_unique_idx` ON `shot_number_reservation` (`shot_plan_id`,`shot_id`);--> statement-breakpoint

PRAGMA user_version = 61;--> statement-breakpoint
PRAGMA foreign_keys=ON;
