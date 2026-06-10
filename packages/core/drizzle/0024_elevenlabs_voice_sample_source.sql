ALTER TABLE `cast_voice` ADD `sample_source_kind` text DEFAULT 'custom_file' NOT NULL;--> statement-breakpoint
ALTER TABLE `cast_voice` ADD `sample_id` text;--> statement-breakpoint
ALTER TABLE `cast_voice` ADD `sample_fetched_at` text;--> statement-breakpoint
ALTER TABLE `cast_voice` ADD `sample_api_base_url` text;--> statement-breakpoint
UPDATE `cast_voice`
SET `sample_source_kind` = 'generated_sample'
WHERE `sample_asset_id` IN (
  SELECT `id` FROM `asset` WHERE `origin` = 'generated'
);--> statement-breakpoint
PRAGMA user_version = 16;
