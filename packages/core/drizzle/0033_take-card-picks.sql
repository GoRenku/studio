ALTER TABLE `scene_shot_video_take` ADD `is_picked` integer DEFAULT false NOT NULL;
--> statement-breakpoint
PRAGMA user_version = 24;
