-- Cast Member, Location and Prop descriptions become sectioned JSON documents
-- (plan 0239). Existing free text cannot be split into sections safely, so it
-- moves word for word into the `overview` section. Blank text becomes NULL.
-- The trim character set matches ECMAScript whitespace in the schema's \S pattern.
UPDATE `cast_member`
SET `description` = CASE
	WHEN `description` IS NULL OR trim(`description`, char(
		9, 10, 11, 12, 13, 32, 160, 5760,
		8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202,
		8232, 8233, 8239, 8287, 12288, 65279
	)) = '' THEN NULL
	ELSE json_object('overview', `description`)
END;--> statement-breakpoint
UPDATE `location`
SET `description` = CASE
	WHEN `description` IS NULL OR trim(`description`, char(
		9, 10, 11, 12, 13, 32, 160, 5760,
		8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202,
		8232, 8233, 8239, 8287, 12288, 65279
	)) = '' THEN NULL
	ELSE json_object('overview', `description`)
END;--> statement-breakpoint
UPDATE `prop`
SET `description` = CASE
	WHEN `description` IS NULL OR trim(`description`, char(
		9, 10, 11, 12, 13, 32, 160, 5760,
		8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202,
		8232, 8233, 8239, 8287, 12288, 65279
	)) = '' THEN NULL
	ELSE json_object('overview', `description`)
END;--> statement-breakpoint
PRAGMA user_version = 74;
