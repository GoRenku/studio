-- Custom data contraction is required before the generated schema changes.
-- A selected legacy row is authoritative. Without a selection, only a sole
-- current row is unambiguous. The guard deliberately aborts before mutation
-- when either legacy role has multiple unselected current rows.
CREATE TEMP TABLE `__lookbook_role_migration_guard` (
  `valid` integer NOT NULL CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `__lookbook_role_migration_guard` (`valid`)
SELECT CASE WHEN EXISTS (
  SELECT 1
  FROM `lookbook` l
  WHERE l.`discarded_at` IS NULL
    AND l.`type` IN ('movie', 'storyboard')
    AND NOT EXISTS (
      SELECT 1 FROM `lookbook_selection` s
      WHERE s.`lookbook_type` = l.`type`
    )
  GROUP BY l.`type`
  HAVING COUNT(*) > 1
) THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__lookbook_role_migration_guard`;--> statement-breakpoint
DELETE FROM `lookbook`
WHERE `discarded_at` IS NULL
  AND `type` IN ('movie', 'storyboard')
  AND `id` <> COALESCE(
    (
      SELECT s.`lookbook_id`
      FROM `lookbook_selection` s
      WHERE s.`lookbook_type` = `lookbook`.`type`
    ),
    `id`
  );--> statement-breakpoint
DROP TABLE `storyboard_lookbook_source_movie`;--> statement-breakpoint
DROP TABLE `lookbook_selection`;--> statement-breakpoint
UPDATE `lookbook` SET `type` = 'production' WHERE `type` = 'movie';--> statement-breakpoint
ALTER TABLE `lookbook` RENAME COLUMN "type" TO "kind";--> statement-breakpoint
CREATE UNIQUE INDEX `lookbook_current_kind_unique_idx` ON `lookbook` (`kind`) WHERE "lookbook"."discarded_at" is null;--> statement-breakpoint
PRAGMA user_version = 43;
