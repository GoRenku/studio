CREATE TABLE `cast_voice_provider_registration` (
	`id` text PRIMARY KEY NOT NULL,
	`cast_voice_id` text NOT NULL,
	`provider` text NOT NULL,
	`registration_model` text NOT NULL,
	`external_voice_id` text NOT NULL,
	`capabilities_json` text NOT NULL,
	`source_sample_asset_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`cast_voice_id`) REFERENCES `cast_voice`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_sample_asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cast_voice_provider_registration_voice_idx` ON `cast_voice_provider_registration` (`cast_voice_id`,`provider`);--> statement-breakpoint
CREATE INDEX `cast_voice_provider_registration_external_idx` ON `cast_voice_provider_registration` (`provider`,`registration_model`,`external_voice_id`);--> statement-breakpoint
INSERT INTO `cast_voice_provider_registration` (
	`id`,
	`cast_voice_id`,
	`provider`,
	`registration_model`,
	`external_voice_id`,
	`capabilities_json`,
	`source_sample_asset_id`,
	`created_at`,
	`updated_at`
)
SELECT
	'cast_voice_provider_registration_' || `id`,
	`id`,
	`provider`,
	`model`,
	`voice_id`,
	'["dialogue-audio-tts"]',
	`sample_asset_id`,
	`created_at`,
	`updated_at`
FROM `cast_voice`;--> statement-breakpoint
DROP INDEX `cast_voice_provider_model_voice_idx`;--> statement-breakpoint
ALTER TABLE `cast_voice` DROP COLUMN `provider`;--> statement-breakpoint
ALTER TABLE `cast_voice` DROP COLUMN `model`;--> statement-breakpoint
ALTER TABLE `cast_voice` DROP COLUMN `voice_id`;--> statement-breakpoint
PRAGMA user_version = 19;
