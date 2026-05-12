import { asc, count, desc, eq, gt, isNotNull, lt } from "drizzle-orm"
import type { Metadata } from "next"
import { db } from "@/lib/db"
import { files } from "@/lib/db/schema"
import { getFirstPdfPageUrl } from "@/lib/file-url"
import { getFile } from "@/lib/r2"
import { FileViewer } from "./file-viewer"

interface Props {
  params: Promise<{ path: string[] }>
}

const FILE_EXTENSION_REGEX = /\.[^/.]+$/

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params
  const fileKey = decodeURIComponent(path.join("/"))
  const docName =
    fileKey.replace(FILE_EXTENSION_REGEX, "").split("/").pop() || fileKey

  const [file] = await db
    .select({
      title: files.title,
      description: files.description,
      agency: files.agency,
      thumbnailUrl: files.thumbnailUrl,
      r2Key: files.r2Key,
    })
    .from(files)
    .where(eq(files.r2Key, fileKey))
    .limit(1)

  const title = file?.title ?? docName
  const description =
    file?.description ??
    `Declassified ${file?.agency ? `${file.agency} ` : ""}document from the [ufo]files archive`

  let ogImage: string | undefined = file?.thumbnailUrl ?? undefined
  if (file?.r2Key?.endsWith(".pdf")) {
    ogImage = getFirstPdfPageUrl(file.r2Key)
  }

  return {
    title: `${title} - [ufo]files`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      ...(ogImage && {
        images: [{ url: ogImage, alt: title }],
      }),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(ogImage && {
        images: [ogImage],
      }),
    },
  }
}

async function getPdfPageCount(fileKey: string): Promise<number> {
  if (!fileKey.toLowerCase().endsWith(".pdf")) {
    return 0
  }
  try {
    const parts = fileKey.split("/")
    const release =
      parts.length >= 3 && parts[0] === "source" ? parts[1] : "release-1"
    const manifestKey = `assets/${release}/pdf-pages/manifest.json`

    const manifestFile = await getFile(manifestKey)
    if (!manifestFile) {
      console.warn("[pdf-viewer] manifest not found in R2")
      return 0
    }
    const text = await new Response(manifestFile.body).text()
    const manifest = JSON.parse(text) as Record<string, { pages: number }>
    const count = manifest[fileKey]?.pages ?? 0
    console.log(
      `[pdf-viewer] fileKey="${fileKey}" → ${count} pages (manifest has ${Object.keys(manifest).length} entries)`
    )
    return count
  } catch (err) {
    console.error("[pdf-viewer] manifest fetch failed:", err)
    return 0
  }
}

export default async function FileViewerPage({ params }: Props) {
  const { path } = await params
  const fileKey = decodeURIComponent(path.join("/"))

  const [currentFile, prevFile, nextFile, [totalResult], pageCount] =
    await Promise.all([
      db
        .select({
          id: files.id,
          r2Key: files.r2Key,
          fileSize: files.fileSize,
          documentUrl: files.documentUrl,
          transcriptR2Key: files.transcriptR2Key,
        })
        .from(files)
        .where(eq(files.r2Key, fileKey))
        .limit(1)
        .then((r) => r[0] ?? null),
      db
        .select({ r2Key: files.r2Key })
        .from(files)
        .where(lt(files.r2Key, fileKey))
        .orderBy(desc(files.r2Key))
        .limit(1)
        .then((r) => r[0] ?? null),
      db
        .select({ r2Key: files.r2Key })
        .from(files)
        .where(gt(files.r2Key, fileKey))
        .orderBy(asc(files.r2Key))
        .limit(1)
        .then((r) => r[0] ?? null),
      db.select({ count: count() }).from(files).where(isNotNull(files.r2Key)),
      getPdfPageCount(fileKey),
    ])

  let currentIndex = 0
  if (currentFile) {
    const [{ count: before }] = await db
      .select({ count: count() })
      .from(files)
      .where(lt(files.r2Key, fileKey))
    currentIndex = before
  }

  return (
    <FileViewer
      currentIndex={currentIndex}
      documentUrl={currentFile?.documentUrl}
      fileDate=""
      fileId={currentFile?.id ?? null}
      fileKey={fileKey}
      fileSize={Number(currentFile?.fileSize ?? 0)}
      nextFileKey={nextFile?.r2Key ?? null}
      pageCount={pageCount}
      prevFileKey={prevFile?.r2Key ?? null}
      totalFiles={totalResult.count}
      transcriptR2Key={currentFile?.transcriptR2Key ?? null}
    />
  )
}
