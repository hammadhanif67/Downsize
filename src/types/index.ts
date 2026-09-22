// Core domain types (spec §5). Everything else in the app derives from these.

export type SupportedMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface SourceImage {
  file: File;
  bitmap: ImageBitmap; // orientation already applied
  width: number; // natural width after orientation
  height: number;
  bytes: number;
  mime: SupportedMime;
  name: string; // original filename without extension
  previewUrl: string; // object URL — must be revoked on replace
}

export type ResizeMode = 'dimensions' | 'percentage';

export interface ResizeSettings {
  mode: ResizeMode;
  width: number;
  height: number;
  lockAspect: boolean;
  percentage: number; // 1–100, used when mode === 'percentage'
  presetId: string | null;
}

export interface ResizeResult {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  previewUrl: string; // must be revoked when replaced
}

// Discriminated union, not strings — the UI maps each `kind` to a message
// (spec §9.5). This keeps copy out of the logic layer.
export type AppError =
  | { kind: 'unsupported-type'; received: string }
  | { kind: 'too-large'; bytes: number }
  | { kind: 'decode-failed' }
  | { kind: 'dimensions-too-large'; width: number; height: number }
  | { kind: 'encode-failed' };
