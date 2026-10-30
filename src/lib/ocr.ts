// Reads a photo of a "leaked paper" into text on this device. Nothing is uploaded: the engine and the English and
// Hindi data are served by this site (see scripts/ocr-assets.mjs) and only load the first time someone uses it.
export async function readPhoto(file: Blob, onProgress: (pct: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js")
  const worker = await createWorker(["eng", "hin"], 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/core",
    langPath: "/ocr/lang",
    // a blob: worker would need a looser Content-Security-Policy than the site allows
    workerBlobURL: false,
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress(Math.round(m.progress * 100))
    },
  })
  try {
    const { data } = await worker.recognize(file)
    return data.text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 2)
      .join("\n")
  } finally {
    await worker.terminate()
  }
}
