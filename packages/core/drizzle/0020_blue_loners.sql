CREATE TABLE `lookbook_sheet` (
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
CREATE INDEX `lookbook_sheet_order_idx` ON `lookbook_sheet` (`lookbook_id`,`sort_order`,`id`);