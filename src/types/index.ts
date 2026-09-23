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

export type CompressMode = 'quality' | 'target';

export type SizeUnit = 'KB' | 'MB';

export interface CompressSettings {
  mode: CompressMode;
  // 0–1, as canvas.toBlob wants it. There is exactly ONE quality in the
  // app: "Target size" is not a second setting, it is a second way of
  // choosing this one. A search writes its answer back here, which is why
  // switching modes never loses anything.
  quality: number;
  targetValue: number;
  targetUnit: SizeUnit;
}

// What a target-size search cost and whether it succeeded. Separate from
// CompressSettings because it describes a past run, not a setting: it is
// cleared the moment the output stops being the thing that search produced.
export interface CompressOutcome {
  quality: number;
  attempts: number;
  reachable: boolean;
  targetBytes: number;
  bytes: number;
}

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
