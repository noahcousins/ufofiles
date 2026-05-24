# [ufo]files

This is a Next.js app for searching, browsing, and downloading officially released government documents about UFOs and UAP.

## Getting started

First, clone the repository and install dependencies:

```bash
git clone https://github.com/noahcousins/ufofiles.git
cd ufofiles
pnpm install
```

Then, copy the `.env.example` file to `.env.local` and add your environment variables.

To get the project up and running, run the following command:

```bash
pnpm dev
```

This will start the development server at `http://localhost:3000`.

## Scraping

[ufo]files uses a custom scraping pipeline to ingest declassified government UFO/UAP files posted to the [WAR.GOV/UFO portal](https://war.gov/ufo).

Though all files are archived and available for download on [showmeufos.com](https://showmeufos.com), anyone can use the scraping commands to download their own copy of the files from the source.

The scraping pipeline is defined in the `scripts/scrape/` directory. It is a series of steps that download the files from the source and ingest them into the database and cloud storage. For more information, see the Scraping pipeline file (tbd).

## File storage

[ufo]files uses Cloudflare R2 to store the files, and uses a Cloudflare Worker to serve them.

The infrastructure for the R2 based file storage was derived from [a project by Rhys Sullivan](https://github.com/RhysSullivan/epstein-files-browser).