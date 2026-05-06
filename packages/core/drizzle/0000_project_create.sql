CREATE TABLE `cast_member` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text,
	`role` text,
	`short_description` text,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clip` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`visual_intent` text,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `episode` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`short_title` text,
	`episode_number` integer,
	`summary` text,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_language` (
	`id` text PRIMARY KEY NOT NULL,
	`locale_tag` text NOT NULL,
	`display_name` text,
	`is_base` integer NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`format` text,
	`base_language` text,
	`logline` text,
	`summary` text,
	`aspect_ratio` text,
	`resolution_width` integer,
	`resolution_height` integer,
	`cover_file` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scene` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sequence` (
	`id` text PRIMARY KEY NOT NULL,
	`episode_id` text,
	`title` text NOT NULL,
	`short_title` text,
	`summary` text,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visual_language` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`intent` text,
	`summary` text,
	`position` integer NOT NULL
);
