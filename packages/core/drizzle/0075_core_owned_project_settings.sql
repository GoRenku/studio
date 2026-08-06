CREATE TABLE `project_settings` (
	`singleton_id` integer PRIMARY KEY NOT NULL,
	`document` text NOT NULL,
	CONSTRAINT "project_settings_singleton_id_check" CHECK("project_settings"."singleton_id" = 1)
);
--> statement-breakpoint
INSERT INTO `project_settings` (`singleton_id`, `document`)
SELECT
	1,
	'{"version":1,"screenplayImport":{"createContinuitySubjects":true,"generateContinuityImages":false,"runScreenplayAnalysis":false,"generateSceneBeatSheets":false,"generateBeatStoryboardImages":false},"generation":{"preferCodexImageGeneration":true,"displayPreview":true,"renkuManaged":{"requirePerRunConfirmation":true,"allowConcurrentGenerations":false,"maxConcurrentGenerations":1},"codexBuiltIn":{"requirePerRunConfirmation":false,"allowConcurrentGenerations":true,"maxConcurrentGenerations":5}}}'
WHERE EXISTS (SELECT 1 FROM `project`);
--> statement-breakpoint
PRAGMA user_version = 60;
