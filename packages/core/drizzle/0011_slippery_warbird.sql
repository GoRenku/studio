CREATE TABLE `lookbook_inspiration` (
	`id` text PRIMARY KEY NOT NULL,
	`lookbook_id` text NOT NULL,
	`inspiration_folder_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`lookbook_id`) REFERENCES `lookbook`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inspiration_folder_id`) REFERENCES `inspiration_folder`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lookbook_inspiration_folder_unique_idx` ON `lookbook_inspiration` (`lookbook_id`,`inspiration_folder_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `lookbook_inspiration_order_unique_idx` ON `lookbook_inspiration` (`lookbook_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `lookbook_inspiration_lookup_idx` ON `lookbook_inspiration` (`inspiration_folder_id`,`lookbook_id`);