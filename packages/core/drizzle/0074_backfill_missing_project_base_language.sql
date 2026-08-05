insert into project_locale (
  id,
  locale_tag,
  display_name,
  is_base,
  supports_audio,
  supports_subtitles,
  position
)
select
  'locale_baseenxx',
  'en-US',
  'English',
  1,
  1,
  1,
  0
where exists (select 1 from project)
  and not exists (select 1 from project_locale);
