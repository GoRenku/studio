PRAGMA user_version = 39;--> statement-breakpoint
-- Custom data cleanup: remove obsolete approval artifacts from persisted run estimate snapshots.
UPDATE `media_generation_run`
SET `estimate_snapshot_json` = json_remove(
	`estimate_snapshot_json`,
	'$.costApprovalToken',
	'$.approval'
)
WHERE json_valid(`estimate_snapshot_json`)
	AND (
		json_type(`estimate_snapshot_json`, '$.costApprovalToken') IS NOT NULL
		OR json_type(`estimate_snapshot_json`, '$.approval') IS NOT NULL
	);--> statement-breakpoint
ALTER TABLE `media_generation_run` DROP COLUMN `approval_token`;
