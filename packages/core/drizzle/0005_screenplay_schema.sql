-- This is an intentional destructive migration for the early screenplay schema
-- redesign. Drizzle Kit generated the schema snapshot, but the generated SQL
-- attempted to copy new required sequence columns from the old sequence table.
-- Those columns do not exist in generation 1, and preserving the obsolete
-- episode/clip/continuity-reference data would create invalid relationships.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TABLE `clip_asset`;--> statement-breakpoint
DROP TABLE `clip`;--> statement-breakpoint
DROP TABLE `continuity_reference_asset`;--> statement-breakpoint
DROP TABLE `continuity_reference`;--> statement-breakpoint
DROP TABLE `episode`;--> statement-breakpoint
DROP TABLE `sequence_asset`;--> statement-breakpoint
DROP TABLE `scene_asset`;--> statement-breakpoint
DROP TABLE `scene`;--> statement-breakpoint
DROP TABLE `sequence`;--> statement-breakpoint
ALTER TABLE `cast_member` ADD `age` integer;--> statement-breakpoint
ALTER TABLE `cast_member` ADD `want` text;--> statement-breakpoint
ALTER TABLE `cast_member` ADD `need` text;--> statement-breakpoint
ALTER TABLE `cast_member` ADD `arc` text;--> statement-breakpoint
ALTER TABLE `cast_member` ADD `voice_notes` text;--> statement-breakpoint
ALTER TABLE `cast_member` ADD `description` text;--> statement-breakpoint
ALTER TABLE `cast_member` DROP COLUMN `kind`;--> statement-breakpoint
ALTER TABLE `cast_member` DROP COLUMN `short_description`;--> statement-breakpoint
ALTER TABLE `cast_member` DROP COLUMN `created_at`;--> statement-breakpoint
ALTER TABLE `cast_member` DROP COLUMN `updated_at`;--> statement-breakpoint
CREATE TABLE `screenplay` (
	`title` text NOT NULL,
	`intended_audience` text,
	`target_length_label` text,
	`estimated_minutes` integer,
	`genre_primary` text,
	`genre_secondary` text,
	`tone` text,
	`rating_intent` text,
	`boundaries` text,
	`logline` text,
	`summary` text,
	`premise_overview` text,
	`central_conflict` text,
	`dramatic_question` text,
	`themes` text,
	`historical_basis` text,
	`dramatized_elements` text,
	`structure_model` text,
	`status` text,
	`research_sources` text,
	`assumptions_made` text
);
--> statement-breakpoint
CREATE TABLE `act` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`purpose` text,
	`key_beats` text,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `act_position_id_idx` ON `act` (`position`,`id`);--> statement-breakpoint
CREATE TABLE `location` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`time_period` text,
	`description` text,
	`visual_notes` text,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `location_position_id_idx` ON `location` (`position`,`id`);--> statement-breakpoint
CREATE TABLE `sequence` (
	`id` text PRIMARY KEY NOT NULL,
	`act_id` text NOT NULL,
	`title` text NOT NULL,
	`purpose` text,
	`position` integer NOT NULL,
	FOREIGN KEY (`act_id`) REFERENCES `act`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sequence_act_position_id_idx` ON `sequence` (`act_id`,`position`,`id`);--> statement-breakpoint
CREATE TABLE `scene` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text NOT NULL,
	`title` text NOT NULL,
	`interior_exterior` text,
	`time_of_day` text,
	`story_function` text,
	`position` integer NOT NULL,
	FOREIGN KEY (`sequence_id`) REFERENCES `sequence`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scene_sequence_position_id_idx` ON `scene` (`sequence_id`,`position`,`id`);--> statement-breakpoint
CREATE TABLE `scene_location` (
	`scene_id` text NOT NULL,
	`location_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`scene_id`, `location_id`),
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scene_location_scene_position_idx` ON `scene_location` (`scene_id`,`position`);--> statement-breakpoint
CREATE TABLE `block` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`type` text NOT NULL,
	`text` text,
	`cast_id` text,
	`extension` text,
	`parenthetical` text,
	`lines` text,
	`render` integer,
	`position` integer NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cast_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `block_scene_position_id_idx` ON `block` (`scene_id`,`position`,`id`);--> statement-breakpoint
CREATE TABLE `block_cast_member` (
	`block_id` text NOT NULL,
	`cast_member_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`block_id`, `cast_member_id`),
	FOREIGN KEY (`block_id`) REFERENCES `block`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `block_cast_member_block_position_idx` ON `block_cast_member` (`block_id`,`position`);--> statement-breakpoint
CREATE TABLE `block_location` (
	`block_id` text NOT NULL,
	`location_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`block_id`, `location_id`),
	FOREIGN KEY (`block_id`) REFERENCES `block`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `block_location_block_position_idx` ON `block_location` (`block_id`,`position`);--> statement-breakpoint
CREATE TABLE `location_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`location_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`locale_id` text,
	`role` text NOT NULL,
	`sort_order` integer NOT NULL,
	`selection` text DEFAULT 'take' NOT NULL,
	`selection_order` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`locale_id`) REFERENCES `project_locale`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `location_asset_filter_order_idx` ON `location_asset` (`location_id`,`role`,`selection`,`selection_order`,`sort_order`,`asset_id`);--> statement-breakpoint
CREATE TABLE `sequence_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`locale_id` text,
	`role` text NOT NULL,
	`sort_order` integer NOT NULL,
	`selection` text DEFAULT 'take' NOT NULL,
	`selection_order` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`sequence_id`) REFERENCES `sequence`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`locale_id`) REFERENCES `project_locale`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sequence_asset_filter_order_idx` ON `sequence_asset` (`sequence_id`,`role`,`selection`,`selection_order`,`sort_order`,`asset_id`);--> statement-breakpoint
CREATE TABLE `scene_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`locale_id` text,
	`role` text NOT NULL,
	`sort_order` integer NOT NULL,
	`selection` text DEFAULT 'take' NOT NULL,
	`selection_order` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`locale_id`) REFERENCES `project_locale`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scene_asset_filter_order_idx` ON `scene_asset` (`scene_id`,`role`,`selection`,`selection_order`,`sort_order`,`asset_id`);--> statement-breakpoint
PRAGMA user_version = 2;--> statement-breakpoint
PRAGMA foreign_keys=ON;
