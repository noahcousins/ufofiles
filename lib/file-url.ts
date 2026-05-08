export function getFileUrl(r2Key: string): string {
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL
  if (!workerUrl) {
    throw new Error(
      "NEXT_PUBLIC_WORKER_URL is not set. File serving requires the Cloudflare Worker."
    )
  }
  const encoded = r2Key.split("/").map(encodeURIComponent).join("/")
  return `${workerUrl}/${encoded}`
}
