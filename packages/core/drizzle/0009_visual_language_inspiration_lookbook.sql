CREATE TABLE `inspiration_analysis` (
	`folder_id` text PRIMARY KEY NOT NULL,
	`thesis` text NOT NULL,
	`palette` text NOT NULL,
	`tone_mood` text NOT NULL,
	`composition` text NOT NULL,
	`lighting` text NOT NULL,
	`texture` text NOT NULL,
	`inspired_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`folder_id`) REFERENCES `inspiration_folder`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `inspiration_folder` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`project_relative_path` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inspiration_folder_position_id_idx` ON `inspiration_folder` (`position`,`id`);--> statement-breakpoint
CREATE TABLE `lookbook` (
	`id` text PRIMARY KEY NOT NULL,
	`thesis` text NOT NULL,
	`palette` text NOT NULL,
	`tone_mood` text NOT NULL,
	`composition` text NOT NULL,
	`lighting` text NOT NULL,
	`texture` text NOT NULL,
	`camera` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lookbook_image_section` (
	`id` text PRIMARY KEY NOT NULL,
	`image_id` text NOT NULL,
	`section` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`image_id`) REFERENCES `lookbook_image`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lookbook_image_section_order_idx` ON `lookbook_image_section` (`section`,`sort_order`,`id`);--> statement-breakpoint
CREATE INDEX `lookbook_image_section_image_idx` ON `lookbook_image_section` (`image_id`);--> statement-breakpoint
CREATE TABLE `lookbook_image` (
	`id` text PRIMARY KEY NOT NULL,
	`lookbook_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`lookbook_id`) REFERENCES `lookbook`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lookbook_image_order_idx` ON `lookbook_image` (`lookbook_id`,`sort_order`,`id`);--> statement-breakpoint
DROP TABLE `visual_language_asset`;--> statement-breakpoint
DROP TABLE `visual_language`;--> statement-breakpoint
DROP TABLE `visual_language_category`;