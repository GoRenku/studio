CREATE TABLE `continuity_reference_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`continuity_reference_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`locale_id` text,
	`role` text NOT NULL,
	`sort_order` integer NOT NULL,
	`selection` text DEFAULT 'take' NOT NULL,
	`selection_order` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`continuity_reference_id`) REFERENCES `continuity_reference`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`locale_id`) REFERENCES `project_locale`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `continuity_reference` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`one_line_summary` text,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visual_language_category` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`source` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `visual_language` ADD `category_id` text NOT NULL REFERENCES visual_language_category(id);--> statement-breakpoint
ALTER TABLE `visual_language` ADD `priority` text NOT NULL;