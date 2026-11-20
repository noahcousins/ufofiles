# Scraper

The pipeline that downloads the declassified UAP files from [war.gov/ufo](https://war.gov/ufo) and turns them into what [ufo]files serves. Run it to get your own copy of a release straight from the source.

## Requirements

- Node and pnpm (`pnpm install` from the repo root)
- `poppler` (for `pdftoppm` and `pdftotext`), `ffmpeg` (for `ffmpeg` and `ffprobe`), and `tesseract` for the OCR step. On macOS: `brew install poppler ffmpeg tesseract`
- A `.env.local` at the repo root (copy `.env.example`)

## Run it

Every step takes `--release release-N`. Without it the release comes from the `RELEASE` env var, and then falls back to `release-1`.

```bash
pnpm scrape --release release-1        # steps 01–12 in order, stops at the first failure
pnpm scrape:csv --release release-1    # or one step at a time
```

| Step | Command | Needs |
| --- | --- | --- |
| 01 fetch CSV | `scrape:csv` | nothing |
| 02 parse CSV | `scrape:parse` | nothing |
| 03 download documents | `scrape:docs` | nothing |
| 04 download videos | `scrape:videos` | `DVIDS_API_KEY` ([get one from DVIDS](https://api.dvidshub.net/)) |
| 05 PDF page previews | `scrape:pdf-previews` | poppler |
| 06 PDF text | `scrape:pdf-text` | poppler |
| 07 video previews | `scrape:video-previews` | ffmpeg |
| 08 card thumbnails | `scrape:card-thumbs` | nothing |
| 09 transcode video | `scrape:transcode` | ffmpeg |
| 10 upload source files | `scrape:upload` | `R2_*` credentials |
| 11 upload derived assets | `scrape:upload-assets` | `R2_*` credentials |
| 12 link DB records | `scrape:link` | `DATABASE_URL` with `files` rows already present |
| 13 OCR scanned PDFs | `scrape:extract-ocr` | tesseract, `DATABASE_URL` |

Steps 01 to 09 only write to disk, under `ufo-files/{release}/` (gitignored). If you only want the files, stop after step 09.

Steps 10 and later publish to Cloudflare R2 and Postgres the way the live site does. Step 12 updates existing `files` rows and doesn't create them, so you'll need to load the parsed records (`ufo-records-{release}.json`) into your database first.

Release dates and all tunables (concurrency, ffmpeg presets, paths) live in `config.ts`.
