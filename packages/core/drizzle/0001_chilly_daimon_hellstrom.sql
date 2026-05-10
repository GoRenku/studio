ALTER TABLE `asset` RENAME COLUMN "asset_type" TO "type";--> statement-breakpoint
ALTER TABLE `asset` RENAME COLUMN "status" TO "availability";--> statement-breakpoint
ALTER TABLE `cast_asset` RENAME COLUMN "asset_role" TO "role";--> statement-breakpoint
ALTER TABLE `clip_asset` RENAME COLUMN "asset_role" TO "role";--> statement-breakpoint
ALTER TABLE `project_asset` RENAME COLUMN "asset_role" TO "role";--> statement-breakpoint
ALTER TABLE `scene_asset` RENAME COLUMN "asset_role" TO "role";--> statement-breakpoint
ALTER TABLE `sequence_asset` RENAME COLUMN "asset_role" TO "role";--> statement-breakpoint
ALTER TABLE `visual_language_asset` RENAME COLUMN "asset_role" TO "role";--> statement-breakpoint
ALTER TABLE `cast_asset` ADD `selection` text DEFAULT 'take' NOT NULL;--> statement-breakpoint
ALTER TABLE `cast_asset` ADD `selection_order` integer;--> statement-breakpoint
ALTER TABLE `clip_asset` ADD `selection` text DEFAULT 'take' NOT NULL;--> statement-breakpoint
ALTER TABLE `clip_asset` ADD `selection_order` integer;--> statement-breakpoint
ALTER TABLE `project_asset` ADD `selection` text DEFAULT 'take' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_asset` ADD `selection_order` integer;--> statement-breakpoint
ALTER TABLE `scene_asset` ADD `selection` text DEFAULT 'take' NOT NULL;--> statement-breakpoint
ALTER TABLE `scene_asset` ADD `selection_order` integer;--> statement-breakpoint
ALTER TABLE `sequence_asset` ADD `selection` text DEFAULT 'take' NOT NULL;--> statement-breakpoint
ALTER TABLE `sequence_asset` ADD `selection_order` integer;--> statement-breakpoint
ALTER TABLE `visual_language_asset` ADD `selection` text DEFAULT 'take' NOT NULL;--> statement-breakpoint
ALTER TABLE `visual_language_asset` ADD `selection_order` integer;