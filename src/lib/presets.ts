// Preset catalogue (spec §7). A discriminated union, not one shape with
// optional fields — 'dimensions' presets are pixel pairs (height may be
// null, meaning "keep the source ratio"); 'scale' presets are a percentage
// and have no width/height of their own at all. The two don't fit the same
// interface, which is exactly why §5's original Preset type didn't work.
export type PresetGroup = 'Social' | 'Web' | 'Common';

export type Preset =
  | { id: string; label: string; group: PresetGroup; kind: 'dimensions'; width: number; height: number | null }
  | { id: string; label: string; group: PresetGroup; kind: 'scale'; percentage: number };

// Kept in sync with index.html's "Common image sizes" table by hand — see
// the note on that table (§11.3.4) and the §14 checklist line for it.
export const PRESETS: Preset[] = [
  // Social
  { id: 'instagram-post', label: 'Instagram Post', group: 'Social', kind: 'dimensions', width: 1080, height: 1080 },
  { id: 'instagram-portrait', label: 'Instagram Portrait', group: 'Social', kind: 'dimensions', width: 1080, height: 1350 },
  { id: 'instagram-story', label: 'Instagram Story', group: 'Social', kind: 'dimensions', width: 1080, height: 1920 },
  { id: 'facebook-cover', label: 'Facebook Cover', group: 'Social', kind: 'dimensions', width: 820, height: 312 },
  { id: 'youtube-thumbnail', label: 'YouTube', group: 'Social', kind: 'dimensions', width: 1280, height: 720 },
  { id: 'linkedin-banner', label: 'LinkedIn Banner', group: 'Social', kind: 'dimensions', width: 1584, height: 396 },
  { id: 'x-post', label: 'X Post', group: 'Social', kind: 'dimensions', width: 1600, height: 900 },
  // Web
  { id: 'full-hd-width', label: 'Full HD', group: 'Web', kind: 'dimensions', width: 1920, height: null },
  { id: 'blog-body', label: 'Blog body', group: 'Web', kind: 'dimensions', width: 1200, height: null },
  { id: 'thumbnail', label: 'Thumbnail', group: 'Web', kind: 'dimensions', width: 400, height: null },
  // Common
  { id: 'half-size', label: 'Half size', group: 'Common', kind: 'scale', percentage: 50 },
  { id: 'quarter-size', label: 'Quarter size', group: 'Common', kind: 'scale', percentage: 25 },
];
