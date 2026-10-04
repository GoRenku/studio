-- Documented one-way preservation conversion for plan 0222; generated schema snapshot remains authoritative.
CREATE TEMP TABLE conversion_guard_0 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject source parents without exactly one file.
INSERT INTO conversion_guard_0 SELECT CASE WHEN EXISTS (SELECT 1 FROM asset a WHERE (SELECT count(*) FROM asset_file f WHERE f.asset_id=a.id) != 1) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_0;
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_3 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject missing or ambiguous ownership.
INSERT INTO conversion_guard_3 SELECT CASE WHEN EXISTS (SELECT 1 FROM asset a WHERE (SELECT count(*) FROM asset_membership m WHERE m.asset_id=a.id) != 1) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_3;
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_6 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject incomplete relational identities before conversion.
INSERT INTO conversion_guard_6 SELECT CASE WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_6;
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_9 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject conflicting physical and authored lifecycle/media metadata.
INSERT INTO conversion_guard_9 SELECT CASE WHEN EXISTS (SELECT 1 FROM asset_file f JOIN asset a ON a.id=f.asset_id WHERE f.discarded_at IS NOT a.discarded_at OR f.discard_operation_id IS NOT a.discard_operation_id OR f.restored_at IS NOT a.restored_at OR f.media_kind IS NOT a.media_kind) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_9;
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_12 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject non-normalized retained paths rather than changing existing file paths.
INSERT INTO conversion_guard_12 SELECT CASE WHEN EXISTS (SELECT 1 FROM asset_file WHERE project_relative_path = '' OR project_relative_path LIKE '/%' OR instr(project_relative_path, char(92)) > 0 OR instr(project_relative_path, '//') > 0 OR instr('/' || project_relative_path || '/', '/./') > 0 OR instr('/' || project_relative_path || '/', '/../') > 0) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_12;
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_15 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject duplicate retained paths, including discarded rows.
INSERT INTO conversion_guard_15 SELECT CASE WHEN EXISTS (SELECT 1 FROM asset_file GROUP BY project_relative_path HAVING count(*) != 1) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_15;
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_18 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject mismatched dual identities in shot_plan_clip_take.
INSERT INTO conversion_guard_18 SELECT CASE WHEN EXISTS (SELECT 1 FROM shot_plan_clip_take t JOIN asset_file f ON f.id=t.asset_file_id WHERE f.asset_id IS NOT t.asset_id) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_18;
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_21 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject mismatched dual identities in shot_plan_dialogue_audio_take.
INSERT INTO conversion_guard_21 SELECT CASE WHEN EXISTS (SELECT 1 FROM shot_plan_dialogue_audio_take t JOIN asset_file f ON f.id=t.asset_file_id WHERE f.asset_id IS NOT t.asset_id) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_21;
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_24 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject mismatched dual identities in screenplay_import.
INSERT INTO conversion_guard_24 SELECT CASE WHEN EXISTS (SELECT 1 FROM screenplay_import t JOIN asset_file f ON f.id=t.source_asset_file_id WHERE f.asset_id IS NOT t.source_asset_id) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_24;
--> statement-breakpoint
CREATE TEMP TABLE asset_file_identity_map AS SELECT asset_id, id AS asset_file_id FROM asset_file;
--> statement-breakpoint
CREATE TEMP TABLE retained_file_rows AS SELECT f.id, m.owner_key, a.locale_id, a.type, a.media_kind, a.title, a.one_line_summary, a.reference_name, a.tags, a.origin, a.availability, a.generation_provenance, a.authored_from_shot_plan_id, a.previs_revision_id, a.created_at, a.updated_at, a.discarded_at, a.discard_operation_id, a.restored_at, f.project_relative_path, f.mime_type, f.size_bytes, f.content_hash, f.width, f.height, f.duration_seconds FROM asset_file f JOIN asset a ON a.id=f.asset_id JOIN asset_membership m ON m.asset_id=a.id;
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_29 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject ambiguous Inspiration Trash paths or owners.
INSERT INTO conversion_guard_29 SELECT CASE WHEN EXISTS (SELECT 1 FROM trash_item WHERE item_kind='inspirationImage' AND (owner_kind IS NOT 'inspirationFolder' OR owner_id IS NULL OR original_project_relative_path IS NULL OR json_extract(restore_snapshot_json, '$.folderId') IS NOT owner_id OR json_extract(restore_snapshot_json, '$.originalProjectRelativePath') IS NOT original_project_relative_path)) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_29;
--> statement-breakpoint
CREATE TEMP TABLE inspiration_owner_keys AS
WITH RECURSIVE bytes(id, hexadecimal, position, encoded) AS (
 SELECT id, hex(CAST(id AS BLOB)), 1, '' FROM inspiration_folder
 UNION ALL
 SELECT id, hexadecimal, position + 2, encoded ||
 CASE WHEN (instr('0123456789ABCDEF', substr(hexadecimal, position, 1))-1)*16 + instr('0123456789ABCDEF', substr(hexadecimal, position+1, 1))-1 IN (33,39,40,41,42,45,46,95,126)
 OR (instr('0123456789ABCDEF', substr(hexadecimal, position, 1))-1)*16 + instr('0123456789ABCDEF', substr(hexadecimal, position+1, 1))-1 BETWEEN 48 AND 57
 OR (instr('0123456789ABCDEF', substr(hexadecimal, position, 1))-1)*16 + instr('0123456789ABCDEF', substr(hexadecimal, position+1, 1))-1 BETWEEN 65 AND 90
 OR (instr('0123456789ABCDEF', substr(hexadecimal, position, 1))-1)*16 + instr('0123456789ABCDEF', substr(hexadecimal, position+1, 1))-1 BETWEEN 97 AND 122
 THEN char((instr('0123456789ABCDEF', substr(hexadecimal, position, 1))-1)*16 + instr('0123456789ABCDEF', substr(hexadecimal, position+1, 1))-1)
 ELSE '%' || substr(hexadecimal, position, 2) END
 FROM bytes WHERE position <= length(hexadecimal)
)
SELECT id, 'inspirationFolder:' || encoded AS owner_key FROM bytes WHERE position > length(hexadecimal);
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_33 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject Inspiration Trash referring to an absent folder.
INSERT INTO conversion_guard_33 SELECT CASE WHEN EXISTS (SELECT 1 FROM trash_item t LEFT JOIN inspiration_owner_keys o ON o.id=t.owner_id WHERE t.item_kind='inspirationImage' AND o.id IS NULL) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_33;
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_36 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject historical image paths claimed by another owner.
INSERT INTO conversion_guard_36 SELECT CASE WHEN EXISTS (SELECT 1 FROM trash_item t JOIN retained_file_rows r ON r.project_relative_path=t.original_project_relative_path JOIN inspiration_owner_keys o ON o.id=t.owner_id WHERE t.item_kind='inspirationImage' AND r.owner_key IS NOT o.owner_key) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_36;
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_39 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject historical image paths belonging to multiple folders.
INSERT INTO conversion_guard_39 SELECT CASE WHEN EXISTS (SELECT 1 FROM trash_item t WHERE t.item_kind='inspirationImage' GROUP BY t.original_project_relative_path HAVING count(DISTINCT t.owner_id)>1) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_39;
--> statement-breakpoint
CREATE TEMP TABLE inspiration_file_identity_map AS
SELECT t.original_project_relative_path AS project_relative_path, o.owner_key,
 coalesce(r.id, 'asset_file_' || lower(hex(randomblob(16)))) AS asset_file_id
FROM trash_item t JOIN inspiration_owner_keys o ON o.id=t.owner_id
LEFT JOIN retained_file_rows r ON r.project_relative_path=t.original_project_relative_path
WHERE t.item_kind='inspirationImage' GROUP BY t.original_project_relative_path;
--> statement-breakpoint
INSERT INTO retained_file_rows (id, owner_key, type, media_kind, tags, origin, availability,
 project_relative_path, created_at, updated_at, discarded_at, discard_operation_id, restored_at)
SELECT m.asset_file_id, m.owner_key, 'inspiration_image', 'image', '[]', 'imported', 'ready',
 m.project_relative_path, t.created_at, coalesce(t.restored_at,t.created_at),
 CASE WHEN t.restored_at IS NULL THEN t.created_at END,
 CASE WHEN t.restored_at IS NULL THEN t.operation_id END, t.restored_at
FROM inspiration_file_identity_map m JOIN trash_item t ON t.id=(
 SELECT id FROM trash_item WHERE item_kind='inspirationImage' AND original_project_relative_path=m.project_relative_path
 ORDER BY created_at DESC,id DESC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM retained_file_rows r WHERE r.id=m.asset_file_id);
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_44 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject an unmapped identity in the asset restoration envelope.
INSERT INTO conversion_guard_44 SELECT CASE WHEN EXISTS (SELECT 1 FROM trash_item t WHERE t.item_kind='asset' AND NOT EXISTS (SELECT 1 FROM asset_file_identity_map m WHERE m.asset_id=json_extract(t.restore_snapshot_json,'$.assetId'))) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_44;
--> statement-breakpoint
UPDATE trash_item SET restore_snapshot_json=json_remove(json_set(restore_snapshot_json, '$.assetFileId', (SELECT asset_file_id FROM asset_file_identity_map WHERE asset_id=json_extract(trash_item.restore_snapshot_json, '$.assetId'))), '$.assetId') WHERE item_kind='asset';
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_48 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject an unmapped identity in the lookbookImage restoration envelope.
INSERT INTO conversion_guard_48 SELECT CASE WHEN EXISTS (SELECT 1 FROM trash_item t WHERE t.item_kind='lookbookImage' AND NOT EXISTS (SELECT 1 FROM asset_file_identity_map m WHERE m.asset_id=json_extract(t.restore_snapshot_json,'$.assetId'))) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_48;
--> statement-breakpoint
UPDATE trash_item SET restore_snapshot_json=json_remove(json_set(restore_snapshot_json, '$.assetFileId', (SELECT asset_file_id FROM asset_file_identity_map WHERE asset_id=json_extract(trash_item.restore_snapshot_json, '$.assetId'))), '$.assetId') WHERE item_kind='lookbookImage';
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_52 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject an unmapped identity in the lookbookSheet restoration envelope.
INSERT INTO conversion_guard_52 SELECT CASE WHEN EXISTS (SELECT 1 FROM trash_item t WHERE t.item_kind='lookbookSheet' AND NOT EXISTS (SELECT 1 FROM asset_file_identity_map m WHERE m.asset_id=json_extract(t.restore_snapshot_json,'$.assetId'))) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_52;
--> statement-breakpoint
UPDATE trash_item SET restore_snapshot_json=json_remove(json_set(restore_snapshot_json, '$.assetFileId', (SELECT asset_file_id FROM asset_file_identity_map WHERE asset_id=json_extract(trash_item.restore_snapshot_json, '$.assetId'))), '$.assetId') WHERE item_kind='lookbookSheet';
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_56 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject an unmapped identity in the castVoice restoration envelope.
INSERT INTO conversion_guard_56 SELECT CASE WHEN EXISTS (SELECT 1 FROM trash_item t WHERE t.item_kind='castVoice' AND NOT EXISTS (SELECT 1 FROM asset_file_identity_map m WHERE m.asset_id=json_extract(t.restore_snapshot_json,'$.sampleAssetId'))) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_56;
--> statement-breakpoint
UPDATE trash_item SET restore_snapshot_json=json_remove(json_set(restore_snapshot_json, '$.sampleAssetFileId', (SELECT asset_file_id FROM asset_file_identity_map WHERE asset_id=json_extract(trash_item.restore_snapshot_json, '$.sampleAssetId'))), '$.sampleAssetId') WHERE item_kind='castVoice';
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_60 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject an unmapped identity in the shotPlanDialogueAudioTake restoration envelope.
INSERT INTO conversion_guard_60 SELECT CASE WHEN EXISTS (SELECT 1 FROM trash_item t WHERE t.item_kind='shotPlanDialogueAudioTake' AND NOT EXISTS (SELECT 1 FROM asset_file_identity_map m WHERE m.asset_id=json_extract(t.restore_snapshot_json,'$.assetId'))) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_60;
--> statement-breakpoint
UPDATE trash_item SET restore_snapshot_json=json_remove(json_set(restore_snapshot_json, '$.assetFileId', (SELECT asset_file_id FROM asset_file_identity_map WHERE asset_id=json_extract(trash_item.restore_snapshot_json, '$.assetId'))), '$.assetId') WHERE item_kind='shotPlanDialogueAudioTake';
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_64 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject unmapped common Trash item identities.
INSERT INTO conversion_guard_64 SELECT CASE WHEN EXISTS (SELECT 1 FROM trash_item t WHERE item_kind='asset' AND NOT EXISTS (SELECT 1 FROM asset_file_identity_map m WHERE m.asset_id=t.item_id)) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_64;
--> statement-breakpoint
UPDATE trash_item SET item_id=(SELECT asset_file_id FROM asset_file_identity_map WHERE asset_id=trash_item.item_id), item_kind='assetFile' WHERE item_kind='asset';
--> statement-breakpoint
UPDATE trash_item SET item_id=(SELECT asset_file_id FROM inspiration_file_identity_map WHERE project_relative_path=trash_item.original_project_relative_path), restore_snapshot_json=json_object('assetFileId',(SELECT asset_file_id FROM inspiration_file_identity_map WHERE project_relative_path=trash_item.original_project_relative_path)), title='', item_kind='assetFile' WHERE item_kind='inspirationImage';
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_69 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject unmapped Shot restoration image identities.
INSERT INTO conversion_guard_69 SELECT CASE WHEN EXISTS (SELECT 1 FROM trash_item t,json_each(t.restore_snapshot_json,'$.images.assetIds') j WHERE t.item_kind='shot' AND NOT EXISTS (SELECT 1 FROM asset_file_identity_map m WHERE m.asset_id=j.value)) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_69;
--> statement-breakpoint
UPDATE trash_item SET restore_snapshot_json=json_remove(json_set(restore_snapshot_json,'$.images.assetFileIds',json((SELECT json_group_array(asset_file_id) FROM (SELECT m.asset_file_id FROM json_each(trash_item.restore_snapshot_json,'$.images.assetIds') j JOIN asset_file_identity_map m ON m.asset_id=j.value ORDER BY CAST(j.key AS INTEGER))))),'$.images.assetIds') WHERE item_kind='shot';
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_73 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Reject unmapped Shot Plan restoration image identities.
INSERT INTO conversion_guard_73 SELECT CASE WHEN EXISTS (SELECT 1 FROM trash_item t,json_each(t.restore_snapshot_json,'$.shots') sh,json_each(sh.value,'$.images.assetIds') j WHERE t.item_kind='shotPlan' AND NOT EXISTS (SELECT 1 FROM asset_file_identity_map m WHERE m.asset_id=j.value)) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_73;
--> statement-breakpoint
UPDATE trash_item SET restore_snapshot_json=json_set(restore_snapshot_json,'$.shots',json((SELECT json_group_array(json(converted)) FROM (SELECT json_remove(json_set(sh.value,'$.images.assetFileIds',json((SELECT json_group_array(asset_file_id) FROM (SELECT m.asset_file_id FROM json_each(sh.value,'$.images.assetIds') j JOIN asset_file_identity_map m ON m.asset_id=j.value ORDER BY CAST(j.key AS INTEGER))))),'$.images.assetIds') AS converted FROM json_each(trash_item.restore_snapshot_json,'$.shots') sh ORDER BY CAST(sh.key AS INTEGER))))) WHERE item_kind='shotPlan';
--> statement-breakpoint
CREATE TEMP TABLE preserved_cast_voice_default AS SELECT * FROM cast_voice_default;
--> statement-breakpoint
CREATE TEMP TABLE preserved_lookbook_image_section AS SELECT * FROM lookbook_image_section;
--> statement-breakpoint
CREATE TEMP TABLE preserved_cast_voice AS SELECT * FROM cast_voice;
--> statement-breakpoint
CREATE TEMP TABLE preserved_lookbook_image AS SELECT * FROM lookbook_image;
--> statement-breakpoint
CREATE TEMP TABLE preserved_lookbook_sheet AS SELECT * FROM lookbook_sheet;
--> statement-breakpoint
CREATE TEMP TABLE preserved_shot_plan_dialogue_audio_take AS SELECT * FROM shot_plan_dialogue_audio_take;
--> statement-breakpoint
CREATE TEMP TABLE preserved_screenplay_import AS SELECT * FROM screenplay_import;
--> statement-breakpoint
CREATE TEMP TABLE preserved_shot_plan_clip AS SELECT * FROM shot_plan_clip;
--> statement-breakpoint
CREATE TEMP TABLE preserved_shot_plan_clip_take AS SELECT * FROM shot_plan_clip_take;
--> statement-breakpoint
CREATE TEMP TABLE preserved_shot_plan_previs_revision AS SELECT * FROM shot_plan_previs_revision;
--> statement-breakpoint
CREATE TEMP TABLE preserved_selected_asset AS SELECT * FROM selected_asset;
--> statement-breakpoint
UPDATE shot_plan_clip SET selected_take_id=NULL;
--> statement-breakpoint
DROP TABLE cast_voice_default;
--> statement-breakpoint
DROP TABLE lookbook_image_section;
--> statement-breakpoint
DROP TABLE cast_voice;
--> statement-breakpoint
DROP TABLE lookbook_image;
--> statement-breakpoint
DROP TABLE lookbook_sheet;
--> statement-breakpoint
DROP TABLE shot_plan_dialogue_audio_take;
--> statement-breakpoint
DROP TABLE screenplay_import;
--> statement-breakpoint
DROP TABLE shot_plan_clip_take;
--> statement-breakpoint
DROP TABLE shot_plan_clip;
--> statement-breakpoint
DROP TABLE shot_plan_previs_revision;
--> statement-breakpoint
DROP TABLE selected_asset;
--> statement-breakpoint
DROP TABLE asset_file;
--> statement-breakpoint
DROP TABLE asset_membership;
--> statement-breakpoint
DROP TABLE asset;
--> statement-breakpoint
CREATE TABLE `asset_file` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_key` text NOT NULL,
	`locale_id` text,
	`type` text NOT NULL,
	`media_kind` text NOT NULL,
	`title` text,
	`one_line_summary` text,
	`reference_name` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`origin` text NOT NULL,
	`availability` text NOT NULL,
	`generation_provenance` text,
	`authored_from_shot_plan_id` text,
	`previs_revision_id` text,
	`project_relative_path` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer,
	`content_hash` text,
	`width` integer,
	`height` integer,
	`duration_seconds` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`locale_id`) REFERENCES `project_locale`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `selected_asset_file` (
	`target_key` text PRIMARY KEY NOT NULL,
	`asset_file_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cast_voice` (
	`id` text PRIMARY KEY NOT NULL,
	`cast_member_id` text NOT NULL,
	`name` text NOT NULL,
	`purpose` text NOT NULL,
	`sample_asset_file_id` text NOT NULL,
	`voice_identity` text,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sample_asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lookbook_image` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_file_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lookbook_sheet` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_file_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shot_plan_previs_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`shot_plan_id` text NOT NULL,
	`number` integer NOT NULL,
	`source_directory` text NOT NULL,
	`source_hash` text NOT NULL,
	`render_hash` text NOT NULL,
	`asset_file_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`shot_plan_id`) REFERENCES `shot_plan`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shot_plan_dialogue_audio_take` (
	`id` text PRIMARY KEY NOT NULL,
	`shot_plan_id` text NOT NULL,
	`asset_file_id` text NOT NULL,
	`turn_start_number` integer NOT NULL,
	`turn_end_number` integer NOT NULL,
	`selected_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	FOREIGN KEY (`shot_plan_id`) REFERENCES `shot_plan`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shot_plan_dialogue_audio_take_start_positive" CHECK("shot_plan_dialogue_audio_take"."turn_start_number" > 0),
	CONSTRAINT "shot_plan_dialogue_audio_take_range_ascending" CHECK("shot_plan_dialogue_audio_take"."turn_end_number" >= "shot_plan_dialogue_audio_take"."turn_start_number")
);
--> statement-breakpoint
CREATE TABLE `screenplay_import` (
	`id` text PRIMARY KEY NOT NULL,
	`singleton_key` integer NOT NULL,
	`source_asset_file_id` text NOT NULL,
	`importer_version` integer NOT NULL,
	`imported_at` text NOT NULL,
	`technical_log_json` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`source_asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "screenplay_import_singleton_check" CHECK("screenplay_import"."singleton_key" = 1),
	CONSTRAINT "screenplay_import_version_check" CHECK("screenplay_import"."importer_version" = 1)
);
--> statement-breakpoint
CREATE TABLE `shot_plan_clip_take` (
	`id` text PRIMARY KEY NOT NULL,
	`clip_id` text NOT NULL,
	`number` integer NOT NULL,
	`title` text,
	`asset_file_id` text NOT NULL,
	`source_take_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`clip_id`) REFERENCES `shot_plan_clip`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_file_id`) REFERENCES `asset_file`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_take_id`) REFERENCES `shot_plan_clip_take`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cast_voice_default` (
	`cast_member_id` text PRIMARY KEY NOT NULL,
	`cast_voice_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`cast_member_id`) REFERENCES `cast_member`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cast_voice_id`) REFERENCES `cast_voice`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `lookbook_image_section` (
	`id` text PRIMARY KEY NOT NULL,
	`image_id` text NOT NULL,
	`section` text NOT NULL,
	`sort_order` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`discarded_at` text,
	`discard_operation_id` text,
	`restored_at` text,
	`point_id` text,
	FOREIGN KEY (`image_id`) REFERENCES `lookbook_image`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shot_plan_clip` (
	`id` text PRIMARY KEY NOT NULL,
	`previs_revision_id` text NOT NULL,
	`number` integer NOT NULL,
	`selected_take_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`previs_revision_id`) REFERENCES `shot_plan_previs_revision`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`selected_take_id`) REFERENCES `shot_plan_clip_take`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO asset_file (id, owner_key, locale_id, type, media_kind, title, one_line_summary, reference_name, tags, origin, availability, generation_provenance, authored_from_shot_plan_id, previs_revision_id, created_at, updated_at, discarded_at, discard_operation_id, restored_at, project_relative_path, mime_type, size_bytes, content_hash, width, height, duration_seconds) SELECT id, owner_key, locale_id, type, media_kind, title, one_line_summary, reference_name, tags, origin, availability, generation_provenance, authored_from_shot_plan_id, previs_revision_id, created_at, updated_at, discarded_at, discard_operation_id, restored_at, project_relative_path, mime_type, size_bytes, content_hash, width, height, duration_seconds FROM retained_file_rows;
--> statement-breakpoint
INSERT INTO selected_asset_file (target_key, asset_file_id, created_at, updated_at) SELECT t.target_key, m.asset_file_id, t.created_at, t.updated_at FROM preserved_selected_asset t JOIN asset_file_identity_map m ON m.asset_id=t.asset_id;
--> statement-breakpoint
INSERT INTO cast_voice (id, cast_member_id, name, purpose, sample_asset_file_id, sort_order, created_at, updated_at, discarded_at, discard_operation_id, restored_at, voice_identity) SELECT t.id, t.cast_member_id, t.name, t.purpose, m.asset_file_id, t.sort_order, t.created_at, t.updated_at, t.discarded_at, t.discard_operation_id, t.restored_at, t.voice_identity FROM preserved_cast_voice t JOIN asset_file_identity_map m ON m.asset_id=t.sample_asset_id;
--> statement-breakpoint
INSERT INTO lookbook_image (id, asset_file_id, sort_order, created_at, updated_at, discarded_at, discard_operation_id, restored_at) SELECT t.id, m.asset_file_id, t.sort_order, t.created_at, t.updated_at, t.discarded_at, t.discard_operation_id, t.restored_at FROM preserved_lookbook_image t JOIN asset_file_identity_map m ON m.asset_id=t.asset_id;
--> statement-breakpoint
INSERT INTO lookbook_sheet (id, asset_file_id, sort_order, created_at, updated_at, discarded_at, discard_operation_id, restored_at) SELECT t.id, m.asset_file_id, t.sort_order, t.created_at, t.updated_at, t.discarded_at, t.discard_operation_id, t.restored_at FROM preserved_lookbook_sheet t JOIN asset_file_identity_map m ON m.asset_id=t.asset_id;
--> statement-breakpoint
INSERT INTO shot_plan_previs_revision (id, shot_plan_id, number, source_directory, source_hash, render_hash, asset_file_id, created_at) SELECT t.id, t.shot_plan_id, t.number, t.source_directory, t.source_hash, t.render_hash, m.asset_file_id, t.created_at FROM preserved_shot_plan_previs_revision t JOIN asset_file_identity_map m ON m.asset_id=t.asset_id;
--> statement-breakpoint
INSERT INTO cast_voice_default (cast_member_id, cast_voice_id, created_at, updated_at) SELECT cast_member_id, cast_voice_id, created_at, updated_at FROM preserved_cast_voice_default;
--> statement-breakpoint
INSERT INTO lookbook_image_section (id, image_id, section, sort_order, created_at, updated_at, discarded_at, discard_operation_id, restored_at, point_id) SELECT id, image_id, section, sort_order, created_at, updated_at, discarded_at, discard_operation_id, restored_at, point_id FROM preserved_lookbook_image_section;
--> statement-breakpoint
INSERT INTO shot_plan_dialogue_audio_take (id, shot_plan_id, asset_file_id, turn_start_number, turn_end_number, selected_at, created_at, updated_at, discarded_at, discard_operation_id, restored_at) SELECT id, shot_plan_id, asset_file_id, turn_start_number, turn_end_number, selected_at, created_at, updated_at, discarded_at, discard_operation_id, restored_at FROM preserved_shot_plan_dialogue_audio_take;
--> statement-breakpoint
INSERT INTO screenplay_import (id, singleton_key, source_asset_file_id, importer_version, imported_at, technical_log_json) SELECT id, singleton_key, source_asset_file_id, importer_version, imported_at, technical_log_json FROM preserved_screenplay_import;
--> statement-breakpoint
INSERT INTO shot_plan_clip (id, previs_revision_id, number, created_at) SELECT id, previs_revision_id, number, created_at FROM preserved_shot_plan_clip;
--> statement-breakpoint
INSERT INTO shot_plan_clip_take (id, clip_id, number, title, asset_file_id, source_take_id, created_at) SELECT id, clip_id, number, title, asset_file_id, source_take_id, created_at FROM preserved_shot_plan_clip_take;
--> statement-breakpoint
UPDATE shot_plan_clip SET selected_take_id=(SELECT selected_take_id FROM preserved_shot_plan_clip WHERE id=shot_plan_clip.id);
--> statement-breakpoint
CREATE INDEX `cast_voice_cast_order_idx` ON `cast_voice` (`cast_member_id`,`sort_order`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `cast_voice_sample_asset_idx` ON `cast_voice` (`sample_asset_file_id`) WHERE "cast_voice"."discarded_at" is null;
--> statement-breakpoint
CREATE UNIQUE INDEX `cast_voice_cast_name_idx` ON `cast_voice` (`cast_member_id`,`name`) WHERE "cast_voice"."discarded_at" is null;
--> statement-breakpoint
CREATE INDEX `lookbook_image_order_idx` ON `lookbook_image` (`sort_order`,`id`);
--> statement-breakpoint
CREATE INDEX `lookbook_sheet_order_idx` ON `lookbook_sheet` (`sort_order`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_previs_number_idx` ON `shot_plan_previs_revision` (`shot_plan_id`,`number`);
--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_previs_content_idx` ON `shot_plan_previs_revision` (`shot_plan_id`,`source_hash`,`render_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_file_path_idx` ON `asset_file` (`project_relative_path`);
--> statement-breakpoint
CREATE INDEX `asset_file_owner_type_locale_idx` ON `asset_file` (`owner_key`,`type`,`locale_id`);
--> statement-breakpoint
CREATE INDEX `asset_file_previs_revision_idx` ON `asset_file` (`previs_revision_id`);
--> statement-breakpoint
CREATE INDEX `shot_plan_dialogue_audio_take_plan_idx` ON `shot_plan_dialogue_audio_take` (`shot_plan_id`,`created_at`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_dialogue_audio_take_asset_idx` ON `shot_plan_dialogue_audio_take` (`asset_file_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `screenplay_import_singleton_unique_idx` ON `screenplay_import` (`singleton_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `screenplay_import_source_file_unique_idx` ON `screenplay_import` (`source_asset_file_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_clip_take_number_idx` ON `shot_plan_clip_take` (`clip_id`,`number`);
--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_clip_take_file_idx` ON `shot_plan_clip_take` (`asset_file_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `cast_voice_default_cast_voice_id_unique` ON `cast_voice_default` (`cast_voice_id`);
--> statement-breakpoint
CREATE INDEX `cast_voice_default_voice_idx` ON `cast_voice_default` (`cast_voice_id`);
--> statement-breakpoint
CREATE INDEX `lookbook_image_section_order_idx` ON `lookbook_image_section` (`section`,`sort_order`,`id`);
--> statement-breakpoint
CREATE INDEX `lookbook_image_section_image_idx` ON `lookbook_image_section` (`image_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `shot_plan_clip_number_idx` ON `shot_plan_clip` (`previs_revision_id`,`number`);
--> statement-breakpoint
ALTER TABLE project ADD asset_file_backfill_version integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TEMP TABLE conversion_guard_150 (valid INTEGER NOT NULL CHECK(valid = 1));
--> statement-breakpoint
-- Require final relational integrity before publishing the schema.
INSERT INTO conversion_guard_150 SELECT CASE WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END;
--> statement-breakpoint
DROP TABLE conversion_guard_150;
--> statement-breakpoint
DROP TABLE preserved_cast_voice_default;
--> statement-breakpoint
DROP TABLE preserved_lookbook_image_section;
--> statement-breakpoint
DROP TABLE preserved_cast_voice;
--> statement-breakpoint
DROP TABLE preserved_lookbook_image;
--> statement-breakpoint
DROP TABLE preserved_lookbook_sheet;
--> statement-breakpoint
DROP TABLE preserved_shot_plan_dialogue_audio_take;
--> statement-breakpoint
DROP TABLE preserved_screenplay_import;
--> statement-breakpoint
DROP TABLE preserved_shot_plan_clip;
--> statement-breakpoint
DROP TABLE preserved_shot_plan_clip_take;
--> statement-breakpoint
DROP TABLE preserved_shot_plan_previs_revision;
--> statement-breakpoint
DROP TABLE preserved_selected_asset;
--> statement-breakpoint
DROP TABLE asset_file_identity_map;
--> statement-breakpoint
DROP TABLE retained_file_rows;
--> statement-breakpoint
DROP TABLE inspiration_owner_keys;
--> statement-breakpoint
DROP TABLE inspiration_file_identity_map;
--> statement-breakpoint
PRAGMA user_version = 71;
