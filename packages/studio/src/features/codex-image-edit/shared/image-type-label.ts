/** UI copy for image Asset types and owner kinds shown in the image edit apps. */
const IMAGE_TYPE_LABELS: Record<string, string> = {
  project_cover: 'Cover',
  cast_profile: 'Profile image',
  character_sheet: 'Character sheet',
  location_hero: 'Hero image',
  location_sheet: 'Location sheet',
  prop_hero: 'Hero image',
  prop_sheet: 'Prop sheet',
  lookbook_image: 'Lookbook image',
  lookbook_sheet: 'Lookbook sheet',
  shot_image: 'Shot image',
  scene_storyboard_image: 'Storyboard image',
  shot_plan_video_first_frame: 'First frame',
  shot_plan_video_last_frame: 'Last frame',
  shot_plan_video_storyboard: 'Storyboard',
  shot_plan_video_reference: 'Reference image',
};

const OWNER_KIND_LABELS: Record<string, string> = {
  project: 'Project',
  castMember: 'Cast',
  location: 'Location',
  prop: 'Prop',
  scene: 'Scene',
  sceneBeat: 'Beat',
  lookbook: 'Lookbook',
  inspirationFolder: 'Inspiration',
  shot: 'Shot',
};

export function imageTypeLabel(type: string): string {
  return IMAGE_TYPE_LABELS[type] ?? 'Image';
}

export function ownerKindLabel(kind: string): string {
  return OWNER_KIND_LABELS[kind] ?? kind;
}
