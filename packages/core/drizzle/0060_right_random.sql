ALTER TABLE `asset_file` ADD `source_generation_spec_id` text REFERENCES media_generation_spec(id);--> statement-breakpoint
ALTER TABLE `media_generation_spec` ADD `execution_kind` text DEFAULT 'renku-managed' NOT NULL;--> statement-breakpoint
PRAGMA user_version = 47;
