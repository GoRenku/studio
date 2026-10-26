-- Plan 0248 gives character sheets their own round defaults. Project Settings
-- version 10 names the casting models and counts `casting.candidateRoutes`
-- and adds `casting.characterSheetRoutes` (empty until the director saves
-- sheet defaults). Drizzle's schema diff cannot express a JSON document
-- change, so this migration is custom: every version 9 settings document is
-- moved to version 10. Any other version fails the guard instead of being
-- guessed at.
--
-- A costume may now only pick a character sheet from its own rounds. No
-- existing sheet belongs to a costume round, so every costume pick is
-- cleared; the sheets stay in their Cast Member's Assets.
CREATE TEMP TABLE `_character_sheet_round_guard` (
	`valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `_character_sheet_round_guard` (`valid`)
SELECT CASE WHEN EXISTS (
	SELECT 1
	FROM `project_settings`
	WHERE json_valid(`document`) = 0
		OR json_extract(`document`, '$.version') <> 9
		OR json_type(`document`, '$.casting.routes') <> 'array'
) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `_character_sheet_round_guard`;--> statement-breakpoint
UPDATE `project_settings`
SET `document` = json_set(
	json_remove(`document`, '$.casting.routes'),
	'$.version', 10,
	'$.casting.candidateRoutes', json(json_extract(`document`, '$.casting.routes')),
	'$.casting.characterSheetRoutes', json('[]')
);--> statement-breakpoint
DELETE FROM `selected_asset_file` WHERE `target_key` LIKE 'castCostume:%';--> statement-breakpoint
PRAGMA user_version = 78;
