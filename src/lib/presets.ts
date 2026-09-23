// Preset catalogue (spec §7). A discriminated union, not one shape with
// optional fields — 'dimensions' presets are pixel pairs (height may be
// null, meaning "keep the source ratio"); 'scale' presets are a percentage
// and have no width/height of their own at all. The two don't fit the same
// interface, which is exactly why §5's original Preset type didn't work.
//
// Grouped by platform rather than by the old Social/Web/Common buckets:
// the picker is now two levels (platform, then that platform's sizes), so
// the group IS the first level. Labels are short because the platform
// supplies the context — "Post" under Instagram rather than "Instagram
// Post", which is what used to overflow a narrow cell.
export type PresetPlatform = 'instagram' | 'youtube' | 'facebook' | 'linkedin' | 'x' | 'web';

export type Preset =
  | { id: string; label: string; platform: PresetPlatform; kind: 'dimensions'; width: number; height: number | null }
  | { id: string; label: string; platform: PresetPlatform; kind: 'scale'; percentage: number };

export interface PlatformMeta {
  id: PresetPlatform;
  label: string;
}

// Order of the platform row.
export const PLATFORMS: PlatformMeta[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X' },
  { id: 'web', label: 'Web' },
];

// The DIMENSIONS here are what index.html's "Common image sizes" table
// must keep matching (§14 checklist). That table spells the names out in
// full — "Instagram Post" rather than "Post" — because a reader of the
// article has no platform heading above the row to supply the context.
export const PRESETS: Preset[] = [
  { id: 'instagram-post', label: 'Post', platform: 'instagram', kind: 'dimensions', width: 1080, height: 1080 },
  { id: 'instagram-portrait', label: 'Portrait', platform: 'instagram', kind: 'dimensions', width: 1080, height: 1350 },
  { id: 'instagram-story', label: 'Story', platform: 'instagram', kind: 'dimensions', width: 1080, height: 1920 },

  { id: 'youtube-thumbnail', label: 'Thumbnail', platform: 'youtube', kind: 'dimensions', width: 1280, height: 720 },

  { id: 'facebook-cover', label: 'Cover', platform: 'facebook', kind: 'dimensions', width: 820, height: 312 },

  { id: 'linkedin-banner', label: 'Banner', platform: 'linkedin', kind: 'dimensions', width: 1584, height: 396 },

  { id: 'x-post', label: 'Post', platform: 'x', kind: 'dimensions', width: 1600, height: 900 },

  { id: 'full-hd-width', label: 'Full HD', platform: 'web', kind: 'dimensions', width: 1920, height: null },
  { id: 'blog-body', label: 'Blog body', platform: 'web', kind: 'dimensions', width: 1200, height: null },
  { id: 'thumbnail', label: 'Thumbnail', platform: 'web', kind: 'dimensions', width: 400, height: null },
  { id: 'half-size', label: 'Half size', platform: 'web', kind: 'scale', percentage: 50 },
  { id: 'quarter-size', label: 'Quarter size', platform: 'web', kind: 'scale', percentage: 25 },
];
