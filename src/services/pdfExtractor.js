/**
 * Clarivo PDF Text Extractor
 * 
 * Extracts actual text content from uploaded PDF reports
 * so the AI can analyze the REAL findings, not hallucinate them.
 * 
 * Uses pdf.js (pdfjs-dist) which runs entirely in the browser.
 */

import * as pdfjsLib from 'pdfjs-dist'

// Use the bundled worker from pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

// Max characters to send to the AI (Gemini has ~1M token context but we limit to be safe)
const MAX_TEXT_LENGTH = 80000

/**
 * Extract text from a PDF file URL.
 * 
 * @param {string} fileUrl - The URL of the PDF file (Firebase Storage URL)
 * @returns {Promise<string>} - The extracted text content
 */
export async function extractTextFromPdfUrl(fileUrl) {
  try {
    console.log('[Clarivo] Extracting text from PDF…')

    const loadingTask = pdfjsLib.getDocument({
      url: fileUrl,
      // Disable range requests for Firebase Storage URLs
      disableRange: true,
      disableStream: true,
    })

    const pdf = await loadingTask.promise
    const totalPages = pdf.numPages
    console.log('[Clarivo] PDF loaded — ' + totalPages + ' pages')

    var allText = []

    for (var i = 1; i <= totalPages; i++) {
      var page = await pdf.getPage(i)
      var textContent = await page.getTextContent()
      var pageText = textContent.items
        .map(function (item) { return item.str })
        .join(' ')
      
      if (pageText.trim()) {
        allText.push('--- Page ' + i + ' ---\n' + pageText)
      }
    }

    var fullText = allText.join('\n\n')

    // Truncate if too long (to stay within API limits)
    if (fullText.length > MAX_TEXT_LENGTH) {
      console.log('[Clarivo] Text truncated from ' + fullText.length + ' to ' + MAX_TEXT_LENGTH + ' chars')
      fullText = fullText.substring(0, MAX_TEXT_LENGTH) +
        '\n\n[... Text truncated at ' + MAX_TEXT_LENGTH + ' characters. Remaining ' +
        (fullText.length - MAX_TEXT_LENGTH) + ' characters omitted.]'
    }

    console.log('[Clarivo] ✓ Extracted ' + fullText.length + ' characters from PDF')
    return fullText

  } catch (err) {
    console.error('[Clarivo] PDF text extraction failed:', err)
    throw new Error('Failed to extract text from PDF: ' + err.message)
  }
}

/**
 * Extract text from a File object (browser File API).
 * Used during upload if we want to extract text before storing.
 * 
 * @param {File} file - The File object from file input
 * @returns {Promise<string>} - The extracted text content
 */
export async function extractTextFromFile(file) {
  try {
    var arrayBuffer = await file.arrayBuffer()
    var uint8Array = new Uint8Array(arrayBuffer)

    var loadingTask = pdfjsLib.getDocument({ data: uint8Array })
    var pdf = await loadingTask.promise
    var totalPages = pdf.numPages

    var allText = []

    for (var i = 1; i <= totalPages; i++) {
      var page = await pdf.getPage(i)
      var textContent = await page.getTextContent()
      var pageText = textContent.items
        .map(function (item) { return item.str })
        .join(' ')

      if (pageText.trim()) {
        allText.push('--- Page ' + i + ' ---\n' + pageText)
      }
    }

    var fullText = allText.join('\n\n')

    if (fullText.length > MAX_TEXT_LENGTH) {
      fullText = fullText.substring(0, MAX_TEXT_LENGTH) +
        '\n\n[... Text truncated at ' + MAX_TEXT_LENGTH + ' characters.]'
    }

    return fullText

  } catch (err) {
    console.error('[Clarivo] PDF file extraction failed:', err)
    throw new Error('Failed to extract text from file: ' + err.message)
  }
}
