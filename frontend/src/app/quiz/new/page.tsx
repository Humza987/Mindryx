'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Upload, FileText, Brain, AlertCircle } from 'lucide-react'
import { createWorker } from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

export default function QuizNewPage() {
  const API_ID = process.env.NEXT_PUBLIC_API_ID
  const router = useRouter()
  const { user } = useUser()

  const [mode, setMode] = useState<'topic' | 'pdf'>('topic')
  const [formData, setFormData] = useState({
    topic: '',
    count: 10,
    difficulty: 'medium',
  })
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [extractedText, setExtractedText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      localStorage.setItem('userId', user.id)
    }
  }, [user])

  const handleModeChange = (newMode: 'topic' | 'pdf') => {
    setMode(newMode)
    setError('')
    setPdfFile(null)
    setExtractedText('')
    setFormData((prev) => ({ ...prev, topic: '' }))
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'count' ? parseInt(value) || 1 : value,
    }))
    setError('')
  }

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      let extractedText = ''

      // UPDATE: Increased page limit for text extraction
      const maxPages = Math.min(pdf.numPages, 100)

      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .trim()

        if (pageText) {
          extractedText += pageText + '\n\n'
        }
      }

      // If we got enough text content, return it
      if (extractedText.trim().length > 0) {
        return extractedText.trim()
      }

      // If PDF doesn't have extractable text, use OCR
      console.log('PDF has minimal text, attempting OCR...')

      const worker = await createWorker('eng')
      let ocrText = ''

      // UPDATE: Increased OCR page limit
      const maxOcrPages = Math.min(pdf.numPages, 100)

      for (let i = 1; i <= maxOcrPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 2.0 })

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')!
        canvas.width = viewport.width
        canvas.height = viewport.height

        const renderTask = page.render({
          canvasContext: context,
          canvas,
          viewport,
        })
        await renderTask.promise

        // OCR the canvas
        const {
          data: { text },
        } = await worker.recognize(canvas)
        ocrText += text + '\n\n'

        // Clean up canvas
        canvas.remove()
      }

      await worker.terminate()
      return ocrText.trim()
    } catch (error) {
      console.error('Error extracting text from PDF:', error)
      throw new Error('Failed to extract text from PDF')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setPdfFile(file)
    setError('')
    setIsExtracting(true)

    try {
      const text = await extractTextFromPDF(file)

      if (!text || text.length < 50) {
        setError(
          'Could not extract enough text from PDF. Please ensure the PDF contains readable text.'
        )
        setIsExtracting(false)
        return
      }

      setExtractedText(text)
      // Auto-generate a topic from the extracted text
      const words = text
        .split(' ')
        .filter((word) => word.length > 2)
        .slice(0, 4)
        .join(' ')
      setFormData((prev) => ({ ...prev, topic: words || 'PDF Content' }))
    } catch (err) {
      console.error('PDF processing error:', err)
      setError('Failed to extract text from PDF. Please try again.')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError('')

    try {
      let requestData: any = {
        userId: localStorage.getItem('userId') || 'anonymous',
        numQuestions: formData.count,
        difficulty: formData.difficulty,
      }

      if (mode === 'topic') {
        if (!formData.topic.trim()) {
          setError('Please enter a topic')
          setIsLoading(false)
          return
        }
        requestData.topic = formData.topic
      } else {
        if (!extractedText) {
          setError('Please upload and process a PDF file first')
          setIsLoading(false)
          return
        }

        requestData.topic = formData.topic || 'Analyze PDF Content'
        requestData.content = extractedText
      }

      console.log('Submitting quiz request:', requestData)

      const response = await fetch(
        `http://localhost:4566/restapis/${API_ID}/dev/_user_request_/quiz`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error:', errorText)
        throw new Error(`API call failed with status: ${response.status}`)
      }

      const result = await response.json()
      console.log('Quiz request result:', result)

      const quizId = result.quizId || result.id || 'quiz-' + Date.now()
      router.push(`/quiz/loading/${quizId}`)
    } catch (error) {
      console.error('Failed to create quiz:', error)
      setError('Failed to create quiz. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
          AI Quiz Generator
        </h2>

        {/* Mode Selection */}
        <div className="mb-8">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleModeChange('topic')}
              className={`p-4 rounded-lg border-2 transition-all ${
                mode === 'topic'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              <Brain className="w-8 h-8 mx-auto mb-2" />
              <div className="font-medium">Topic-Based</div>
              <div className="text-sm opacity-75">Enter a topic or subject</div>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('pdf')}
              className={`p-4 rounded-lg border-2 transition-all ${
                mode === 'pdf'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              <FileText className="w-8 h-8 mx-auto mb-2" />
              <div className="font-medium">PDF Upload</div>
              <div className="text-sm opacity-75">Upload PDF content</div>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6">
          {mode === 'topic' ? (
            <div>
              <label
                htmlFor="topic"
                className="block text-sm font-medium text-gray-900 mb-2"
              >
                Topic:
              </label>
              <input
                type="text"
                id="topic"
                name="topic"
                value={formData.topic}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors placeholder-gray-600"
                placeholder="e.g., JavaScript, History, Science, Machine Learning"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Upload PDF (Max 10MB):
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="pdf-upload"
                  disabled={isExtracting}
                />
                <label
                  htmlFor="pdf-upload"
                  className={`w-full p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors flex flex-col items-center justify-center text-center ${
                    pdfFile
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-300 hover:border-blue-400 bg-gray-50'
                  } ${isExtracting ? 'cursor-not-allowed opacity-75' : ''}`}
                >
                  <Upload className="w-8 h-8 mb-2 text-gray-400" />
                  {isExtracting ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-blue-600 font-medium">Extracting text...</span>
                    </div>
                  ) : pdfFile ? (
                    <div>
                      <div className="text-green-700 font-medium">
                        {pdfFile.name}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Text extracted! Ready to generate quiz.
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium text-gray-600">
                        Click to upload PDF
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        PDF files only, max 10MB
                      </div>
                    </div>
                  )}
                </label>
              </div>

              {extractedText && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Generated Topic (editable):
                  </label>
                  <input
                    type="text"
                    name="topic"
                    value={formData.topic}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Quiz topic based on PDF content"
                  />
                  <div className="mt-2 text-sm text-gray-500">
                    <div className="font-medium mb-1">Text preview:</div>
                    <div className="bg-gray-100 p-3 rounded text-xs max-h-24 overflow-y-auto">
                      {extractedText.substring(0, 300)}...
                    </div>
                    <div className="mt-1 text-xs">
                      Extracted {extractedText.length} characters
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="count"
              className="block text-sm font-medium text-gray-900 mb-2"
            >
              Number of Questions:
            </label>
            <input
              type="number"
              id="count"
              name="count"
              value={formData.count}
              onChange={handleInputChange}
              min="1"
              max="20"
              required
              className="w-full px-4 py-3 text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors placeholder-gray-600"
              placeholder="Enter a number (1-20)"
            />
          </div>

          <div>
            <label
              htmlFor="difficulty"
              className="block text-sm font-medium text-gray-900 mb-2"
            >
              Difficulty:
            </label>
            <select
              id="difficulty"
              name="difficulty"
              value={formData.difficulty}
              onChange={handleInputChange}
              className="w-full px-4 py-3 text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <button
            onClick={handleSubmit}
            disabled={
              isLoading || isExtracting || (mode === 'pdf' && !extractedText)
            }
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-lg text-base transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Creating Quiz...</span>
              </div>
            ) : (
              'Generate Quiz'
            )}
          </button>
        </div>

        {mode === 'pdf' && (
          <div className="mt-6 text-sm text-gray-500">
            <p className="font-medium mb-2">PDF Requirements:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Maximum file size: 10MB</li>
              <li>PDF should contain readable text (or images for OCR)</li>
              <li>Processing is limited to 100 pages for performance.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}