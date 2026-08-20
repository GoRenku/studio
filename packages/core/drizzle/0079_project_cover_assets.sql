-- The root-file cover contract is removed rather than migrated. Abort before
-- the generated Project-table rebuild if a development database still has a
-- non-null legacy value so no selected cover is silently discarded.
CREATE TEMP TABLE `__project_cover_assets_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `__project_cover_assets_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1 FROM `project` WHERE `cover_file` IS NOT NULL
) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__project_cover_assets_guard`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_project` (
	`id` text PRIMARY KEY NOT NULL,
	`project_name` text NOT NULL,
	`title` text NOT NULL,
	`aspect_ratio` text NOT NULL,
	`logline` text,
	`synopsis` text,
	`premise` text,
	`intended_audience` text,
	`format` text,
	`target_runtime_minutes` integer,
	`primary_genre` text,
	`secondary_genres_json` text,
	`tones_json` text,
	`content_rating_intent` text,
	`creative_boundaries_json` text,
	`central_conflict` text,
	`dramatic_question` text,
	`themes_json` text,
	`historical_basis_json` text,
	`dramatized_elements_json` text,
	`screenplay_draft_status` text,
	`research_sources_json` text,
	`assumptions_json` text,
	`open_questions_json` text,
	`next_steps_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "project_project_name_non_empty_check" CHECK(length("__new_project"."project_name") > 0),
	CONSTRAINT "project_title_non_empty_check" CHECK(length("__new_project"."title") > 0),
	CONSTRAINT "project_aspect_ratio_non_empty_check" CHECK(length("__new_project"."aspect_ratio") > 0),
	CONSTRAINT "project_runtime_non_negative_check" CHECK("__new_project"."target_runtime_minutes" is null or "__new_project"."target_runtime_minutes" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_project`("id", "project_name", "title", "aspect_ratio", "logline", "synopsis", "premise", "intended_audience", "format", "target_runtime_minutes", "primary_genre", "secondary_genres_json", "tones_json", "content_rating_intent", "creative_boundaries_json", "central_conflict", "dramatic_question", "themes_json", "historical_basis_json", "dramatized_elements_json", "screenplay_draft_status", "research_sources_json", "assumptions_json", "open_questions_json", "next_steps_json", "created_at", "updated_at") SELECT "id", "project_name", "title", "aspect_ratio", "logline", "synopsis", "premise", "intended_audience", "format", "target_runtime_minutes", "primary_genre", "secondary_genres_json", "tones_json", "content_rating_intent", "creative_boundaries_json", "central_conflict", "dramatic_question", "themes_json", "historical_basis_json", "dramatized_elements_json", "screenplay_draft_status", "research_sources_json", "assumptions_json", "open_questions_json", "next_steps_json", "created_at", "updated_at" FROM `project`;--> statement-breakpoint
DROP TABLE `project`;--> statement-breakpoint
ALTER TABLE `__new_project` RENAME TO `project`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `project_project_name_unique_idx` ON `project` (`project_name`);--> statement-breakpoint
PRAGMA user_version = 64;
