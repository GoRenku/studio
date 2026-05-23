CREATE TABLE `lookbook_card_image` (
	`lookbook_id` text PRIMARY KEY NOT NULL,
	`image_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`lookbook_id`) REFERENCES `lookbook`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `lookbook_image`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `visual_language_state` (
	`id` text PRIMARY KEY NOT NULL,
	`active_lookbook_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`active_lookbook_id`) REFERENCES `lookbook`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `lookbook` ADD `name` text NOT NULL;