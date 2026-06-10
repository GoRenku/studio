CREATE TABLE `scene_dialogue_audio` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`dialogue_id` text NOT NULL,
	`cast_member_id` text NOT NULL,
	`cast_voice_id` text,
	`model_choice` text NOT NULL,
	`plain_text` text NOT NULL,
	`v3_text` text NOT NULL,
	`voice_settings_json` text NOT NULL,
	`output_format` text NOT NULL,
	`language_code` text,
	`picked_take_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cast_voice_id`) REFERENCES `cast_voice`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scene_dialogue_audio_scene_idx` ON `scene_dialogue_audio` (`scene_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scene_dialogue_audio_dialogue_idx` ON `scene_dialogue_audio` (`scene_id`,`dialogue_id`);--> statement-breakpoint
CREATE INDEX `scene_dialogue_audio_cast_member_idx` ON `scene_dialogue_audio` (`cast_member_id`);--> statement-breakpoint
CREATE INDEX `scene_dialogue_audio_cast_voice_idx` ON `scene_dialogue_audio` (`cast_voice_id`);--> statement-breakpoint
CREATE TABLE `scene_dialogue_audio_take` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_dialogue_audio_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`asset_file_id` text NOT NULL,
	`media_generation_run_id` text NOT NULL,
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
	FOREIGN KEY (`scene_dialogue_audio_id`) REFERENCES `scene_dialogue_audio`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`media_generation_run_id`) REFERENCES `media_generation_run`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cast_voice_id`) REFERENCES `cast_voice`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scene_dialogue_audio_take_audio_idx` ON `scene_dialogue_audio_take` (`scene_dialogue_audio_id`,`created_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scene_dialogue_audio_take_asset_idx` ON `scene_dialogue_audio_take` (`asset_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scene_dialogue_audio_take_run_idx` ON `scene_dialogue_audio_take` (`media_generation_run_id`);--> statement-breakpoint
-- Custom migration: existing persisted screenplay dialogue blocks predate
-- durable dialogue IDs. Backfill only missing dialogueId fields in stored
-- scene.blocks_json arrays so future audio takes can attach to a stable target.
UPDATE `scene`
SET `blocks_json` = coalesce(
  (
    SELECT json_group_array(
      CASE
        WHEN json_extract(`block`.`value`, '$.type') = 'dialogue'
          AND json_extract(`block`.`value`, '$.dialogueId') IS NULL
        THEN json_set(
          json(`block`.`value`),
          '$.dialogueId',
          'scene_dialogue_' || lower(hex(randomblob(4)))
        )
        ELSE json(`block`.`value`)
      END
    )
    FROM json_each(`scene`.`blocks_json`) AS `block`
  ),
  '[]'
)
WHERE EXISTS (
  SELECT 1
  FROM json_each(`scene`.`blocks_json`) AS `block`
  WHERE json_extract(`block`.`value`, '$.type') = 'dialogue'
    AND json_extract(`block`.`value`, '$.dialogueId') IS NULL
);--> statement-breakpoint
PRAGMA user_version = 17;
