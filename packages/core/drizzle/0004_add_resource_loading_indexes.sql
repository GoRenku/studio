CREATE INDEX `asset_file_asset_role_idx` ON `asset_file` (`asset_id`,`role`);--> statement-breakpoint
CREATE INDEX `cast_asset_filter_order_idx` ON `cast_asset` (`cast_member_id`,`role`,`selection`,`selection_order`,`sort_order`,`asset_id`);--> statement-breakpoint
CREATE INDEX `cast_member_position_id_idx` ON `cast_member` (`position`,`id`);--> statement-breakpoint
CREATE INDEX `clip_asset_filter_order_idx` ON `clip_asset` (`clip_id`,`role`,`selection`,`selection_order`,`sort_order`,`asset_id`);--> statement-breakpoint
CREATE INDEX `clip_scene_position_id_idx` ON `clip` (`scene_id`,`position`,`id`);--> statement-breakpoint
CREATE INDEX `continuity_reference_asset_filter_order_idx` ON `continuity_reference_asset` (`continuity_reference_id`,`role`,`selection`,`selection_order`,`sort_order`,`asset_id`);--> statement-breakpoint
CREATE INDEX `continuity_reference_position_id_idx` ON `continuity_reference` (`position`,`id`);--> statement-breakpoint
CREATE INDEX `episode_position_id_idx` ON `episode` (`position`,`id`);--> statement-breakpoint
CREATE INDEX `project_asset_filter_order_idx` ON `project_asset` (`role`,`selection`,`selection_order`,`sort_order`,`asset_id`);--> statement-breakpoint
CREATE INDEX `project_locale_position_id_idx` ON `project_locale` (`position`,`id`);--> statement-breakpoint
CREATE INDEX `scene_asset_filter_order_idx` ON `scene_asset` (`scene_id`,`role`,`selection`,`selection_order`,`sort_order`,`asset_id`);--> statement-breakpoint
CREATE INDEX `scene_sequence_position_id_idx` ON `scene` (`sequence_id`,`position`,`id`);--> statement-breakpoint
CREATE INDEX `sequence_asset_filter_order_idx` ON `sequence_asset` (`sequence_id`,`role`,`selection`,`selection_order`,`sort_order`,`asset_id`);--> statement-breakpoint
CREATE INDEX `sequence_episode_position_id_idx` ON `sequence` (`episode_id`,`position`,`id`);--> statement-breakpoint
CREATE INDEX `visual_language_position_id_idx` ON `visual_language` (`position`,`id`);--> statement-breakpoint
CREATE INDEX `visual_language_asset_filter_order_idx` ON `visual_language_asset` (`visual_language_id`,`role`,`selection`,`selection_order`,`sort_order`,`asset_id`);