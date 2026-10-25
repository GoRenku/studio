-- Plan 0244 adds model-neutral image detail levels to casting. Project Settings
-- version 9 requires `casting.candidateDetail` and
-- `casting.characterSheetDetail`. Drizzle's schema diff cannot express a JSON
-- document change, so this migration is custom: every version 8 settings
-- document gets the defaults (candidates `lowest`, character sheets `highest`)
-- and moves to version 9. Any other version fails the guard instead of being
-- guessed at.
CREATE TEMP TABLE `_casting_detail_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `_casting_detail_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM `project_settings`
	WHERE json_valid(`document`) = 0
		OR json_extract(`document`, '$.version') <> 8
		OR json_type(`document`, '$.casting') <> 'object'
) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `_casting_detail_guard`;--> statement-breakpoint
UPDATE `project_settings`
SET `document` = json_set(
	`document`,
	'$.version', 9,
	'$.casting.candidateDetail', 'lowest',
	'$.casting.characterSheetDetail', 'highest'
);--> statement-breakpoint
PRAGMA user_version = 77;
