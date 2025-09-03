"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useSession } from "@clerk/nextjs";
import { useSupabase } from "@/utils/supabase-provider";
import { Upload, FileText, Brain, AlertCircle, Calendar } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

const MAX_PDF_PAGES = 100;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MIN_TEXT_LENGTH = 50;

// If OCR.space API key is provided in NEXT_PUBLIC_OCR_SPACE_API_KEY, the client
// will use it as a final fallback. Note: client-side keys are public — consider
// routing through a server/edge function for production.
const OCR_SPACE_KEY = process.env.NEXT_PUBLIC_OCR_SPACE_API_KEY;

export default function QuizNewPage() {
  const router = useRouter();
  const { user } = useUser();
  const { session } = useSession();
  const { supabase, isLoaded } = useSupabase();

  const [mode, setMode] = useState<"topic" | "pdf">("topic");
  const [formData, setFormData] = useState({
    topic: "",
    count: 10,
    difficulty: "medium",
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState("");
  const [ocrProgress, setOcrProgress] = useState<number>(0);

  // Quiz count state
  const [quizCount, setQuizCount] = useState<{
    currentMonth: number;
    monthStart: string | null;
    isLoading: boolean;
  }>({
    currentMonth: 0,
    monthStart: null,
    isLoading: true,
  });

  useEffect(() => {
    if (user) {
      fetchQuizCount();
    }
  }, [user]);

  const fetchQuizCount = async () => {
    try {
      const response = await fetch("/api/getQuizCount");
      if (response.ok) {
        const { data } = await response.json();
        setQuizCount({
          currentMonth: data.currentMonth.count,
          monthStart: data.currentMonth.monthStart,
          isLoading: false,
        });
      } else {
        // Handle error - set to default values
        setQuizCount({
          currentMonth: 0,
          monthStart: null,
          isLoading: false,
        });
      }
    } catch (err) {
      console.error("Failed to fetch quiz count:", err);
      setQuizCount({
        currentMonth: 0,
        monthStart: null,
        isLoading: false,
      });
    }
  };

  const handleModeChange = (newMode: "topic" | "pdf") => {
    setMode(newMode);
    setError("");
    setPdfFile(null);
    setExtractedText("");
    setFormData((prev) => ({ ...prev, topic: "" }));
    setOcrProgress(0);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "count" ? parseInt(value) || 1 : value,
    }));
    setError("");
  };

  // ---------------------- Image preprocessing helpers ----------------------
  // Improve OCR results by pre-processing the canvas: increase resolution,
  // contrast, convert to grayscale and apply a threshold.
  // ------------------------ Advanced OCR preprocessing -----------------------------------
  const upscaleCanvas = (source: HTMLCanvasElement, scale = 3) => {
    const out = document.createElement("canvas");
    out.width = Math.round(source.width * scale);
    out.height = Math.round(source.height * scale);
    const ctx = out.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, out.width, out.height);
    return out;
  };

  const toGrayscale = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d")!;
    const imgd = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgd.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
    ctx.putImageData(imgd, 0, 0);
    return canvas;
  };

  // Contrast Stretching
  const enhanceContrast = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d")!;
    const imgd = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgd.data;
    let min = 255,
      max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const v = data[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const scale = 255 / (max - min || 1);
    for (let i = 0; i < data.length; i += 4) {
      let v = data[i];
      v = (v - min) * scale;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
    ctx.putImageData(imgd, 0, 0);
    return canvas;
  };

  // Gaussian Blur (simple approx using 3x3 kernel)
  const gaussianBlur = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width;
    const h = canvas.height;
    const src = ctx.getImageData(0, 0, w, h);
    const dst = ctx.createImageData(w, h);
    const s = src.data;
    const d = dst.data;
    const kernel = [
      1 / 16,
      2 / 16,
      1 / 16,
      2 / 16,
      4 / 16,
      2 / 16,
      1 / 16,
      2 / 16,
      1 / 16,
    ];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let sum = 0;
        let idx = (y * w + x) * 4;
        let k = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const i = ((y + ky) * w + (x + kx)) * 4;
            sum += s[i] * kernel[k++];
          }
        }
        d[idx] = d[idx + 1] = d[idx + 2] = sum;
        d[idx + 3] = s[idx + 3];
      }
    }
    ctx.putImageData(dst, 0, 0);
    return canvas;
  };

  // Adaptive Threshold (local mean)
  const adaptiveThreshold = (
    canvas: HTMLCanvasElement,
    blockSize = 15,
    C = 10
  ) => {
    const ctx = canvas.getContext("2d")!;
    const imgd = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgd.data;
    const w = canvas.width;
    const h = canvas.height;
    const copy = new Uint8ClampedArray(data);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0,
          count = 0;
        for (
          let ky = -Math.floor(blockSize / 2);
          ky <= Math.floor(blockSize / 2);
          ky++
        ) {
          for (
            let kx = -Math.floor(blockSize / 2);
            kx <= Math.floor(blockSize / 2);
            kx++
          ) {
            const nx = x + kx;
            const ny = y + ky;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              sum += copy[(ny * w + nx) * 4];
              count++;
            }
          }
        }
        const threshold = sum / count - C;
        const idx = (y * w + x) * 4;
        const val = data[idx] > threshold ? 255 : 0;
        data[idx] = data[idx + 1] = data[idx + 2] = val;
      }
    }
    ctx.putImageData(imgd, 0, 0);
    return canvas;
  };

  // Combined Preprocessing
  const preprocessCanvasForOcr = (src: HTMLCanvasElement) => {
    let c = upscaleCanvas(src, 3);
    c = toGrayscale(c);
    c = enhanceContrast(c);
    c = gaussianBlur(c);
    c = adaptiveThreshold(c, 15, 10);
    return c;
  };

  // ------------------------ OCR helpers -----------------------------------
  const runTesseractOnCanvas = async (
    worker: any,
    canvas: HTMLCanvasElement
  ) => {
    // worker.recognize accepts canvas directly
    const res = await worker.recognize(canvas);
    const text = res?.data?.text || "";
    return text;
  };

  const callOcrSpace = async (file: File) => {
    // Final fallback: OCR.space. Requires API key for production.
    // This runs client-side; exposing API keys in the browser is not secure.
    if (!OCR_SPACE_KEY) return "";
    try {
      const form = new FormData();
      form.append("apikey", OCR_SPACE_KEY);
      form.append("language", "eng");
      form.append("isOverlayRequired", "false");
      form.append("file", file);

      const resp = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: form,
      });
      const json = await resp.json();
      const parsed = json?.ParsedResults?.[0]?.ParsedText || "";
      return parsed;
    } catch (e) {
      console.error("OCR.space error", e);
      return "";
    }
  };

  // Main extract function: pdf.js text -> tesseract (with preprocess) -> OCR.space fallback
  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let extractedText = "";

      const maxPages = Math.min(pdf.numPages, MAX_PDF_PAGES);
      // 1) Try text-layer extraction first (fast and accurate if present)
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ")
          .trim();
        if (pageText) extractedText += pageText + "";
      }

      if (extractedText.trim().length >= MIN_TEXT_LENGTH)
        return extractedText.trim();

      // 2) No text-layer or insufficient text -> fall back to OCR in the browser.
      // Dynamically import tesseract.js (v5+). We purposely don't pass functions
      // into worker options to avoid DataCloneError.
      const tesseract = await import("tesseract.js");
      const createWorker =
        (tesseract as any).createWorker ||
        (tesseract as any).default?.createWorker;
      if (!createWorker)
        throw new Error("tesseract.createWorker not available");

      // Try default v5 worker first
      let worker: any = null;
      try {
        worker = await createWorker("eng");
      } catch (e) {
        // if createWorker('eng') fails, attempt legacy flags
        try {
          worker = await createWorker("eng", 1, {
            legacyCore: true,
            legacyLang: true,
          });
        } catch (e2) {
          throw new Error("Failed to create Tesseract worker");
        }
      }

      let ocrText = "";
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        // render original page to canvas
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d")!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, canvas, viewport }).promise;

        // Preprocess for OCR
        const pre = preprocessCanvasForOcr(canvas);

        // Recognize
        const text = await runTesseractOnCanvas(worker, pre);
        ocrText += text + "";

        // cleanup
        canvas.remove();
        pre.remove();

        setOcrProgress(Math.round((i / maxPages) * 100));
      }

      await worker.terminate();

      // If OCR result is short, try OCR.space fallback (server/cloud-based usually stronger)
      if ((ocrText || "").trim().length < MIN_TEXT_LENGTH) {
        // OCR.space call requires the original file — run only if API key present
        if (OCR_SPACE_KEY) {
          const cloudText = await callOcrSpace(file);
          if (cloudText && cloudText.trim().length >= MIN_TEXT_LENGTH)
            return cloudText.trim();
        }
        // If still nothing useful, return OCR text (possibly short) so the UI can show an error.
      }

      return (ocrText || "").trim();
    } catch (err) {
      console.error("Error extracting text from PDF:", err);
      throw new Error("Failed to extract text from PDF");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("File size must be less than 10MB");
      return;
    }

    setPdfFile(file);
    setError("");
    setIsExtracting(true);

    try {
      const text = await extractTextFromPDF(file);
      if (!text || text.length < MIN_TEXT_LENGTH) {
        setError("Could not extract enough text from PDF.");
        setIsExtracting(false);
        return;
      }
      setExtractedText(text);
      const words = text
        .split(" ")
        .filter((w) => w.length > 2)
        .slice(0, 4)
        .join(" ");
      setFormData((prev) => ({ ...prev, topic: words || "PDF Content" }));
    } catch (err) {
      console.error(err);
      setError("Failed to extract text from PDF. Please try again.");
    } finally {
      setIsExtracting(false);
      setOcrProgress(0);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError("");

    try {
      if (!user) throw new Error("User not signed in");
      if (!session) throw new Error("Session missing - please sign in");

      const clerkToken = await session.getToken();
      if (!clerkToken) {
        throw new Error("Authentication token missing. Please sign in again.");
      }

      const payload: any = {
        topic: formData.topic || "General Knowledge",
        difficulty: formData.difficulty,
        numQuestions: formData.count,
      };
      if (mode === "pdf" && extractedText) {
        payload.content = extractedText;
      }

      console.log("Submitting quiz generation with payload:", payload);
      console.log("Using Clerk token:", clerkToken ? "Present" : "Missing");

      const EDGE_FN_URL =
        process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/generate_quiz";

      const res = await fetch(EDGE_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${clerkToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        setError(
          "Unauthorized: token missing or invalid. Please sign in again."
        );
        setIsLoading(false);
        return;
      }

      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error || json?.message || "Edge function error";
        throw new Error(msg);
      }

      const inserted = json;
      if (!inserted || !inserted.id) {
        throw new Error("Invalid response from generation function");
      }

      // Refresh quiz count after successful generation
      fetchQuizCount();

      router.push(`/quiz/loading/${inserted.id}`);
    } catch (err: any) {
      console.error("Error in handleSubmit:", err);
      setError(err.message || "Failed to create quiz.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatMonthStartDate = (dateString: string | null) => {
    if (!dateString) return "No quizzes yet";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">
            AI Quiz Generator
          </h2>

          {/* Quiz Count Display */}
          <div className="text-right">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <Calendar className="w-4 h-4" />
              <span>This Month</span>
            </div>
            {quizCount.isLoading ? (
              <div className="text-2xl font-bold text-gray-400">...</div>
            ) : (
              <div className="text-2xl font-bold text-blue-600">
                {quizCount.currentMonth}
              </div>
            )}
            <div className="text-xs text-gray-500">
              {quizCount.monthStart
                ? `Since ${formatMonthStartDate(quizCount.monthStart)}`
                : "Create your first quiz!"}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Quiz Source
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => handleModeChange("topic")}
              className={`flex-1 p-4 rounded-lg border-2 transition-all duration-200 ${
                mode === "topic"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              }`}
            >
              <Brain className="w-6 h-6 mx-auto mb-2" />
              <span className="block text-sm font-medium">Topic-Based</span>
              <span className="block text-xs text-gray-500 mt-1">
                Generate quiz from a topic
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("pdf")}
              className={`flex-1 p-4 rounded-lg border-2 transition-all duration-200 ${
                mode === "pdf"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              }`}
            >
              <FileText className="w-6 h-6 mx-auto mb-2" />
              <span className="block text-sm font-medium">PDF Upload</span>
              <span className="block text-xs text-gray-500 mt-1">
                Generate quiz from PDF content
              </span>
            </button>
          </div>
        </div>

        {mode === "pdf" && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload PDF
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
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
                className="cursor-pointer text-blue-600 hover:text-blue-500 font-medium"
              >
                Click to upload PDF
              </label>
              <p className="text-sm text-gray-500 mt-1">PDF files up to 10MB</p>
            </div>

            {pdfFile && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                <p className="text-sm text-gray-700">
                  <FileText className="w-4 h-4 inline mr-1" />
                  {pdfFile.name}
                </p>
                {isExtracting && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600 mr-2"></div>
                    Extracting text...
                  </p>
                )}
              </div>
            )}

            {isExtracting && ocrProgress > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-600 mb-1">
                  OCR progress: {ocrProgress}%
                </p>
                <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
                  <div
                    style={{ width: `${ocrProgress}%` }}
                    className="h-2 bg-blue-600"
                  ></div>
                </div>
              </div>
            )}

            {extractedText && (
              <div className="mt-3 p-3 bg-green-50 rounded-md border border-green-200">
                <p className="text-sm text-green-700 font-medium mb-1">
                  Text extracted successfully!
                </p>
                <p className="text-xs text-green-600">
                  {extractedText.length} characters extracted
                </p>
                <details className="mt-2">
                  <summary className="text-xs text-green-600 cursor-pointer">
                    Preview extracted text
                  </summary>
                  <div className="mt-2 p-2 bg-white rounded text-xs text-gray-600 max-h-32 overflow-y-auto">
                    {extractedText.substring(0, 500)}...
                  </div>
                </details>
              </div>
            )}
          </div>
        )}

        {mode === "topic" && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quiz Topic
            </label>
            <input
              type="text"
              name="topic"
              value={formData.topic}
              onChange={handleInputChange}
              placeholder="e.g., JavaScript, World History, Biology..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder-black"
            />
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Number of Questions
          </label>
          <select
            name="count"
            value={formData.count}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder-black"
          >
            <option value={5}>5 Questions</option>
            <option value={10}>10 Questions</option>
            <option value={15}>15 Questions</option>
            <option value={20}>20 Questions</option>
          </select>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Difficulty Level
          </label>
          <select
            name="difficulty"
            value={formData.difficulty}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black placeholder-black"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={
            isLoading ||
            isExtracting ||
            (mode === "topic" && !formData.topic.trim()) ||
            (mode === "pdf" && !extractedText)
          }
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Generating Quiz...
            </span>
          ) : (
            "Generate Quiz"
          )}
        </button>

        <p className="text-xs text-gray-500 text-center mt-4">
          Quiz generation typically takes 30-60 seconds
        </p>
      </div>
    </div>
  );
}
