CREATE TABLE `media_generation_run` (
	`id` text PRIMARY KEY NOT NULL,
	`spec_id` text NOT NULL,
	`purpose` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`model_choice` text NOT NULL,
	`spec_snapshot_json` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`provider_payload_json` text NOT NULL,
	`estimate_snapshot_json` text NOT NULL,
	`approval_token` text,
	`simulated` integer NOT NULL,
	`status` text NOT NULL,
	`outputs_json` text NOT NULL,
	`diagnostics_json` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`spec_id`) REFERENCES `media_generation_spec`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_generation_run_spec_idx` ON `media_generation_run` (`spec_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `media_generation_run_target_idx` ON `media_generation_run` (`purpose`,`target_kind`,`target_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `media_generation_spec` (
	`id` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`model_choice` text NOT NULL,
	`title` text NOT NULL,
	`spec_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `media_generation_spec_target_idx` ON `media_generation_spec` (`purpose`,`target_kind`,`target_id`,`updated_at`);
--> statement-breakpoint
PRAGMA user_version = 6;
