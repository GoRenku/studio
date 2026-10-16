# GitHub Presentation

How the `GoRenku/studio` and `GoRenku/studio-skills` repository pages are set
up, so they can be refreshed without rediscovering the details.

## README images

The images live in `docs/readme-media/` and are made from media already in
`packages/website/src/assets/media/`. Run from the repository root with
`ffmpeg` and ImageMagick (`magick`):

```sh
M=packages/website/src/assets/media
O=docs/readme-media

# Hero: previs beside the generated take, 10 s loop
ffmpeg -t 10 -i $M/harbor-blender-previs.mp4 -t 10 -i $M/harbor-generation.mp4 \
  -filter_complex "[0:v]fps=15,scale=480:274,setsar=1[l];[1:v]fps=15,scale=480:274,setsar=1[r];[l][r]hstack=inputs=2[v]" \
  -map "[v]" -an -c:v libwebp_anim -quality 70 -loop 0 $O/previs-to-shot.webp

# Made with Renku stills (frames without burned-in words)
ffmpeg -ss 48 -i $M/renku-launch.mp4 -frames:v 1 -vf scale=640:360 -q:v 4 $O/made-with-renku-storyboard.jpg
ffmpeg -ss 117.5 -i $M/renku-launch.mp4 -frames:v 1 -vf scale=640:360 -q:v 4 $O/made-with-renku-character-sheet.jpg
ffmpeg -ss 9 -i $M/first-patron-shot-plan.mp4 -frames:v 1 -vf scale=640:360 -q:v 4 $O/made-with-renku-council-chamber.jpg

# Studio link preview
magick docs/screenshots/codex-and-renku.png -resize 1280x640 -background 'rgb(12,11,9)' \
  -gravity center -extent 1280x640 -strip $O/studio-social-preview.png

# Studio Skills link preview: 2x2 grid of storyboard, character sheet,
# harbor previs at 8 s and harbor generation at 8 s
ffmpeg -ss 8 -i $M/harbor-blender-previs.mp4 -frames:v 1 /tmp/previs8.png
ffmpeg -ss 8 -i $M/harbor-generation.mp4 -frames:v 1 /tmp/gen8.png
for f in $O/made-with-renku-storyboard.jpg $O/made-with-renku-character-sheet.jpg /tmp/previs8.png /tmp/gen8.png; do
  magick "$f" -resize 640x320^ -gravity center -extent 640x320 "/tmp/tile-$(basename "${f%.*}").png"
done
magick \( /tmp/tile-made-with-renku-storyboard.png /tmp/tile-made-with-renku-character-sheet.png +append \) \
  \( /tmp/tile-previs8.png /tmp/tile-gen8.png +append \) -append -quality 85 -strip $O/studio-skills-social-preview.jpg
```

Check each image by eye. Link previews must be PNG, JPG or GIF under 1 MB at
1280×640. GitHub does not play committed videos, so the launch film is linked
on gorenku.com rather than embedded.

## Repository settings

Link previews are uploaded by hand: repository → Settings → General → Social
preview → Edit → Upload an image (`studio-social-preview.png` for Studio,
`studio-skills-social-preview.jpg` for Studio Skills).

Descriptions, homepages and topics:

```sh
gh repo edit GoRenku/studio \
  --description "Open-source, local-first film studio you direct through Codex or Claude Code. Screenplay, cast, locations, shot plans, Blender previs and AI-generated footage in one project on your computer." \
  --homepage https://gorenku.com \
  --add-topic filmmaking,ai-filmmaking,film-production,pre-production,screenwriting,storyboard,previs,blender,generative-ai,ai-video,video-generation,image-generation,codex,claude-code,ai-agents,local-first,sqlite,typescript
gh repo edit GoRenku/studio-skills \
  --description "A film crew of 20 skills for Codex, Claude Code and other coding agents: screenwriting, casting, lookbooks, shot planning, Blender previs and media generation for Renku Studio." \
  --homepage https://gorenku.com \
  --add-topic agent-skills,claude-code,claude-code-plugin,codex,codex-plugin,ai-agents,filmmaking,ai-filmmaking,screenwriting,storyboard,previs,blender,generative-ai,ai-video,prompt-engineering,fal-ai,elevenlabs,replicate
```

"20 skills" appears in the Studio Skills description, its README opening and
the organization profile. Update all three when the skill count changes.

## Community

- Discussions are on in `GoRenku/studio` only, with categories Announcements,
  Help, Ideas, Show and tell, and Model requests. Studio Skills links there.
- Issue forms live in `.github/ISSUE_TEMPLATE/` in each repository.
- `CODE_OF_CONDUCT.md` (Contributor Covenant 3.0) is in each repository;
  reports go to support@codingventures.com.

## Releases

Release notes and the Latest badge come from `pnpm release`; see
[Release notes](distribution-and-release.md#release-notes).
