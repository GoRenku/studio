CREATE TABLE `asset_file` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`role` text NOT NULL,
	`project_relative_path` text NOT NULL,
	`mime_type` text,
	`media_kind` text NOT NULL,
	`size_bytes` integer,
	`content_hash` text,
	`width` integer,
	`height` integer,
	`duration_seconds` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `asset` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_type` text NOT NULL,
	`media_kind` text NOT NULL,
	`title` text NOT NULL,
	`one_line_summary` text,
	`origin` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cast_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`cast_member_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`locale_id` text,
	`asset_role` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`locale_id`) REFERENCES `project_locale`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cast_member` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text,
	`role` text,
	`short_description` text,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clip_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`clip_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`locale_id` text,
	`asset_role` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`clip_id`) REFERENCES `clip`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`locale_id`) REFERENCES `project_locale`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clip` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`title` text NOT NULL,
	`one_line_summary` text,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `episode` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`short_title` text,
	`episode_number` integer,
	`one_line_summary` text,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`locale_id` text,
	`asset_role` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`locale_id`) REFERENCES `project_locale`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_locale` (
	`id` text PRIMARY KEY NOT NULL,
	`locale_tag` text NOT NULL,
	`display_name` text,
	`is_base` integer NOT NULL,
	`supports_audio` integer DEFAULT true NOT NULL,
	`supports_subtitles` integer DEFAULT true NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`logline` text,
	`aspect_ratio` text,
	`cover_file` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scene_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`locale_id` text,
	`asset_role` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scene`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`locale_id`) REFERENCES `project_locale`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scene` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text NOT NULL,
	`title` text NOT NULL,
	`one_line_summary` text,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`sequence_id`) REFERENCES `sequence`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sequence_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`locale_id` text,
	`asset_role` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`sequence_id`) REFERENCES `sequence`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`locale_id`) REFERENCES `project_locale`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sequence` (
	`id` text PRIMARY KEY NOT NULL,
	`episode_id` text,
	`title` text NOT NULL,
	`short_title` text,
	`one_line_summary` text,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`episode_id`) REFERENCES `episode`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `visual_language` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`one_line_summary` text,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visual_language_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`visual_language_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`locale_id` text,
	`asset_role` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`visual_language_id`) REFERENCES `visual_language`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`locale_id`) REFERENCES `project_locale`(`id`) ON UPDATE no action ON DELETE no action
);
