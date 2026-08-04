PRAGMA foreign_keys=OFF;--> statement-breakpoint
-- Custom preservation: Drizzle rebuilds both parent tables to remove their
-- Scene foreign keys. Migrations run transactionally, where SQLite cannot
-- disable foreign-key actions, so retain the active Beat Sheet pointers and
-- Dialogue Audio Takes before either parent table is dropped.
CREATE TABLE `__preserved_scene_beat_sheet_state` AS
SELECT * FROM `scene_beat_sheet_state`;--> statement-breakpoint
CREATE TABLE `__preserved_scene_dialogue_audio_take` AS
SELECT * FROM `scene_dialogue_audio_take`;--> statement-breakpoint
CREATE TABLE `__new_scene_beat_sheet_state` (
	`scene_id` text PRIMARY KEY NOT NULL,
	`active_beat_sheet_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`active_beat_sheet_id`) REFERENCES `scene_beat_sheet`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_scene_beat_sheet_state`("scene_id", "active_beat_sheet_id", "created_at", "updated_at") SELECT "scene_id", "active_beat_sheet_id", "created_at", "updated_at" FROM `scene_beat_sheet_state`;--> statement-breakpoint
DROP TABLE `scene_beat_sheet_state`;--> statement-breakpoint
ALTER TABLE `__new_scene_beat_sheet_state` RENAME TO `scene_beat_sheet_state`;--> statement-breakpoint
CREATE TABLE `__new_scene_beat_sheet` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`title` text NOT NULL,
	`document` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_scene_beat_sheet`("id", "scene_id", "title", "document", "created_at", "updated_at") SELECT "id", "scene_id", "title", "document", "created_at", "updated_at" FROM `scene_beat_sheet`;--> statement-breakpoint
DROP TABLE `scene_beat_sheet`;--> statement-breakpoint
ALTER TABLE `__new_scene_beat_sheet` RENAME TO `scene_beat_sheet`;--> statement-breakpoint
CREATE INDEX `scene_beat_sheet_scene_updated_idx` ON `scene_beat_sheet` (`scene_id`,`updated_at`,`id`);--> statement-breakpoint
DELETE FROM `scene_beat_sheet_state`;--> statement-breakpoint
INSERT INTO `scene_beat_sheet_state`
SELECT * FROM `__preserved_scene_beat_sheet_state`;--> statement-breakpoint
DROP TABLE `__preserved_scene_beat_sheet_state`;--> statement-breakpoint
CREATE TABLE `__new_scene_dialogue_audio` (
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
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cast_voice_id`) REFERENCES `cast_voice`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_scene_dialogue_audio`("id", "scene_id", "turn_id", "cast_member_id", "cast_voice_id", "model_choice", "plain_text", "v3_text", "voice_settings_json", "output_format", "language_code", "created_at", "updated_at") SELECT "id", "scene_id", "turn_id", "cast_member_id", "cast_voice_id", "model_choice", "plain_text", "v3_text", "voice_settings_json", "output_format", "language_code", "created_at", "updated_at" FROM `scene_dialogue_audio`;--> statement-breakpoint
DROP TABLE `scene_dialogue_audio`;--> statement-breakpoint
ALTER TABLE `__new_scene_dialogue_audio` RENAME TO `scene_dialogue_audio`;--> statement-breakpoint
CREATE INDEX `scene_dialogue_audio_scene_idx` ON `scene_dialogue_audio` (`scene_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scene_dialogue_audio_turn_idx` ON `scene_dialogue_audio` (`scene_id`,`turn_id`);--> statement-breakpoint
CREATE INDEX `scene_dialogue_audio_cast_member_idx` ON `scene_dialogue_audio` (`cast_member_id`);--> statement-breakpoint
CREATE INDEX `scene_dialogue_audio_cast_voice_idx` ON `scene_dialogue_audio` (`cast_voice_id`);--> statement-breakpoint
INSERT INTO `scene_dialogue_audio_take`
SELECT * FROM `__preserved_scene_dialogue_audio_take`;--> statement-breakpoint
DROP TABLE `__preserved_scene_dialogue_audio_take`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA user_version = 59;
