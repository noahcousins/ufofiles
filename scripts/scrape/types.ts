/** Core record shape - matches the JSON consumed by seed-db.ts */
export interface UfoRecord {
  agency: string
  description: string
  documentUrl: string
  imageUrl: string
  incidentDate: string
  incidentLocation: string
  redacted: string
  releaseDate: string
  title: string
  type: string
  videoId: string
}

/** A single downloadable file returned by the DVIDS API */
export interface DvidsAssetFile {
  height?: number
  size: number
  src: string
  type: string
  width?: number
}

/** The `results` object inside a DVIDS asset response */
export interface DvidsResult {
  branch: string
  date: string
  description: string
  duration: string
  files: DvidsAssetFile[]
  title: string
  unit_name: string
  url: string
}

/** Top-level DVIDS API response for a single asset */
export interface DvidsApiResponse {
  results: DvidsResult
}

/** Aggregated download statistics */
export interface DownloadStats {
  failed: number
  skipped: number
  success: number
  total: number
}

/** Preview generation statistics */
export interface PreviewStats {
  failed: number
  generated: number
  skipped: number
  total: number
}
