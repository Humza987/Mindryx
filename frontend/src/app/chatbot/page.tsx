"use client";

import { useState, useEffect, useRef } from "react";

import * as webllm from "@mlc-ai/web-llm";
import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";

// Set worker src for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

import {
  ArrowUp,
  Copy,
  Cpu,
  FileUp,
  Loader,
  RefreshCw,
  XCircle,
} from "lucide-react";

// --- Model Configuration ---
const modelConfig = [
  {
    id: "Llama-3-8B-Instruct-q4f32_1-MLC",
    name: "Llama 3",
    params: "8B",
    size: "4.6 GB",
    description:
      "Meta's powerful and versatile model, great for complex chat and instruction following.",
  },
  {
    id: "Phi-3-mini-4k-instruct-q4f32_1-MLC",
    name: "Phi-3 Mini",
    params: "3.8B",
    size: "2.2 GB",
    description:
      "Microsoft's high-performing small model, balances speed and capability.",
  },
  {
    id: "Mistral-7B-Instruct-v0.2-q4f32_1-MLC",
    name: "Mistral v0.2",
    params: "7B",
    size: "4.1 GB",
    description:
      "A popular and strong model known for its reasoning abilities.",
  },
  {
    id: "gemma-2b-it-q4f32_1-MLC",
    name: "Gemma",
    params: "2B",
    size: "1.4 GB",
    description:
      "Google's lightweight and capable model, ideal for faster responses on most devices.",
  },
  {
    id: "TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC",
    name: "TinyLlama",
    params: "1.1B",
    size: "650 MB",
    description:
      "Very small and fast, perfect for quick tasks and devices with limited memory.",
  },
  {
    id: "Qwen2-0.5B-Instruct-q4f16_1-MLC",
    name: "Qwen2",
    params: "0.5B",
    size: "300 MB",
    description:
      "An extremely small, fast, and efficient model for quick, on-the-go tasks.",
  },
  {
    id: "gemma-7b-it-q4f32_1-MLC",
    name: "Gemma 7B",
    params: "7B",
    size: "4.6 GB",
    description:
      "A larger version of Gemma with improved performance and reasoning.",
  },
  {
    id: "Phi-3-mini-128k-instruct-q4f32_1-MLC",
    name: "Phi-3 Mini Long",
    params: "3.8B",
    size: "2.2 GB",
    description:
      "Optimized for processing very long contexts, great for large documents.",
  },
  {
    id: "Llama-2-7B-Chat-q4f32_1-MLC",
    name: "Llama 2",
    params: "7B",
    size: "4.1 GB",
    description:
      "A highly-regarded foundational model, widely used for conversational tasks.",
  },
];

export default function WebLLMChatPage() {
  // --- State Management ---
  const [engine, setEngine] = useState<webllm.MLCEngineInterface | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState({
    progress: 0,
    text: "Not loaded",
  });
  const [chatHistory, setChatHistory] = useState<
    webllm.ChatCompletionMessageParam[]
  >([]);
  const [userInput, setUserInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfContext, setPdfContext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const loadModel = async (modelId: string) => {
    setError(null);
    setSelectedModel(modelId);
    setLoadingState({ progress: 0, text: "Initializing engine..." });

    try {
      const engine: webllm.MLCEngineInterface = await webllm.CreateMLCEngine(
        modelId,
        {
          initProgressCallback: (progress: any) => {
            setLoadingState({
              progress: progress.progress * 100,
              text: progress.text,
            });
          },
        }
      );
      setEngine(engine);
      setLoadingState({ progress: 100, text: "Model loaded successfully!" });
      setChatHistory([
        {
          role: "system",
          content:
            "You are a helpful AI assistant running entirely in the browser.",
        },
      ]);
    } catch (e: any) {
      setError(
        `Failed to load model. Your browser may not support WebGPU, or there was a network error. Details: ${e.message}`
      );
      console.error(e);
      setSelectedModel(null);
      setLoadingState({ progress: 0, text: "Error loading model" });
    }
  };

  const handleChatSubmit = async () => {
    if (!userInput.trim() || !engine || isGenerating) return;

    setIsGenerating(true);
    const newUserMessage: webllm.ChatCompletionMessageParam = {
      role: "user",
      content: userInput,
    };
    const historyWithUserMessage = [...chatHistory, newUserMessage];
    setChatHistory(historyWithUserMessage);
    setUserInput("");

    let messagesForEngine = [...historyWithUserMessage];

    if (
      pdfContext &&
      pdfContext !== "Extracting text from PDF..." &&
      pdfContext !== "Direct extraction failed, trying OCR..."
    ) {
      const systemMessageIndex = messagesForEngine.findIndex(
        (msg) => msg.role === "system"
      );
      const pdfSystemContent = `You have access to a PDF document. When users ask questions, reference this content when relevant:\n\n--- DOCUMENT CONTENT ---\n${pdfContext}\n--- END DOCUMENT ---\n\nAnswer based on this document when appropriate, but also use your general knowledge for other topics.`;

      if (systemMessageIndex >= 0) {
        messagesForEngine[systemMessageIndex] = {
          role: "system",
          content: `You are a helpful AI assistant. ${pdfSystemContent}`,
        };
      } else {
        messagesForEngine.unshift({
          role: "system",
          content: pdfSystemContent,
        });
      }
    }

    try {
      const chunks = await engine.chat.completions.create({
        stream: true,
        messages: messagesForEngine,
      });

      let reply = "";
      const assistantMessage: webllm.ChatCompletionMessageParam = {
        role: "assistant",
        content: "",
      };
      setChatHistory([...historyWithUserMessage, assistantMessage]);

      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content || "";
        reply += delta;
        setChatHistory((prev) => {
          const newHistory = [...prev];
          if (newHistory.length > 0) {
            newHistory[newHistory.length - 1].content = reply;
          }
          return newHistory;
        });
      }
    } catch (e: any) {
      setError(`An error occurred during chat generation: ${e.message}`);
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const extractTextFromPDF = async (file: File) => {
    setError(null);
    setPdfContext("Extracting text from PDF...");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      const maxPages = Math.min(pdf.numPages, 10);

      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        fullText += pageText + "\n\n";
      }

      if (fullText.trim().length < 100) {
        console.log("Minimal text found, attempting OCR...");
        setPdfContext("Direct extraction failed, trying OCR...");
        const worker = await Tesseract.createWorker("eng");
        const {
          data: { text },
        } = await worker.recognize(file);
        fullText = text;
        await worker.terminate();
      }

      const truncatedText =
        fullText.trim().length > 8000
          ? fullText.trim().substring(0, 8000) +
            "\n\n[Content truncated for performance...]"
          : fullText.trim();

      setPdfContext(truncatedText);

      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `📄 PDF "${
            file.name
          }" has been loaded successfully. I can now answer questions about its content. The document contains ${
            fullText.trim().split(" ").length
          } words across ${Math.min(pdf.numPages, 50)} pages.`,
        },
      ]);
    } catch (e: any) {
      setError(`Failed to process PDF: ${e.message}`);
      setPdfContext(null);
      console.error(e);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      extractTextFromPDF(file);
    } else {
      setError("Please upload a valid PDF file.");
    }
  };

  const handleClearChat = () => {
    engine?.unload();
    setEngine(null);
    setSelectedModel(null);
    setChatHistory([]);
    setPdfContext(null);
    setError(null);
    setLoadingState({ progress: 0, text: "Not loaded" });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .catch((err) => console.error("Failed to copy text.", err));
  };

  // --- UI Rendering ---
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-5xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            Experimental Feature: Client-Side AI Chat
          </h1>
          <p className="text-gray-600 mt-2">Powered by WebLLM & WebGPU</p>
        </header>

        {error && (
          <div
            className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg relative mb-4"
            role="alert"
          >
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {!engine ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <h2 className="text-2xl font-semibold mb-2 text-center text-gray-900">
              Select a Model to Download and Chat With!
            </h2>
            <p className="text-gray-600 text-center mb-6">
              Models are downloaded and run directly in your browser. No data
              leaves your computer. For this experimental feature no external
              API requests are made, everything runs in the browser using your
              own devices computing power. Smaller models are not as accurate,
              but larger models require more computing power. This is mainly an
              experimental feature, to showcase the power of WebLLM and the
              power of running LLM's directly in the browser.{" "}
            </p>
            <p className="text-gray-600 text-center mb-6">
              To delete downloaded model: Inspect Element → Application → Cache
              Storage → Clear WebLLM Entries. Then refresh the page.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modelConfig.map((model) => (
                <div
                  key={model.id}
                  className={`bg-white p-5 rounded-xl border ${
                    selectedModel === model.id
                      ? "ring-2 ring-purple-400 border-purple-100"
                      : "hover:shadow-md border-gray-100"
                  }`}
                >
                  <h3 className="text-xl font-bold text-gray-900">
                    {model.name}{" "}
                    <span className="text-sm font-normal text-gray-500">
                      ({model.params})
                    </span>
                  </h3>
                  <p className="text-gray-600 text-sm mt-1 mb-3 h-16">
                    {model.description}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">
                      {model.size}
                    </span>
                    <button
                      onClick={() => loadModel(model.id)}
                      disabled={!!selectedModel}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {selectedModel && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-center mb-2 text-gray-800">
                  {loadingState.text}
                </h3>
                <div className="w-full bg-gray-100 rounded-full h-4">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-cyan-400 h-4 rounded-full transition-all duration-500"
                    style={{ width: `${loadingState.progress}%` }}
                  ></div>
                </div>
              </div>
            )}
            <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-700">
              <h4 className="font-bold text-gray-900 mb-2 flex items-center">
                <Cpu size={18} className="mr-2" />
                Tips for Best Performance:
              </h4>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  A modern computer with a dedicated GPU is recommended for
                  larger models.
                </li>
                <li>
                  Ensure your browser (Chrome, Edge) is up-to-date and supports{" "}
                  <span className="font-semibold text-purple-600">WebGPU</span>.
                </li>
                <li>
                  The first model load will be slow as it downloads. Subsequent
                  loads will be much faster due to caching.
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-[70vh] bg-white rounded-2xl shadow-sm p-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <div className="font-semibold text-lg">
                Chatting with:{" "}
                <span className="text-purple-600">
                  {modelConfig.find((m) => m.id === selectedModel)?.name}
                </span>
              </div>
              <button
                onClick={handleClearChat}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <RefreshCw size={16} className="mr-2" /> New Chat
              </button>
            </div>

            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto pr-2 space-y-4 bg-gray-50 p-3 rounded"
            >
              {chatHistory.map(
                (msg, index) =>
                  (msg.role === "user" || msg.role === "assistant") && (
                    <div
                      key={index}
                      className={`flex items-start gap-3 ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white">
                          A
                        </div>
                      )}
                      <div
                        className={`max-w-xl p-3 rounded-xl relative group ${
                          msg.role === "user"
                            ? "bg-purple-600 text-white"
                            : "bg-white border border-gray-100"
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm">
                          {(msg as any).content}
                        </p>
                        <button
                          onClick={() => copyToClipboard(msg.content as string)}
                          className="absolute -top-2 -right-2 bg-gray-50 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Copy size={14} className="text-gray-600" />
                        </button>
                      </div>
                    </div>
                  )
              )}
              {isGenerating && (
                <div className="flex items-start gap-3 justify-start">
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white">
                    A
                  </div>
                  <div className="max-w-xl p-3 rounded-xl bg-white border border-gray-100 flex items-center">
                    <Loader className="animate-spin" size={20} />
                  </div>
                </div>
              )}
            </div>

            {pdfContext && (
              <div className="my-2 p-2 bg-gray-50 rounded-lg text-xs text-gray-700 flex justify-between items-center border border-gray-100">
                <p className="truncate">
                  <span className="font-bold">Context:</span>{" "}
                  {pdfContext.substring(0, 100)}...
                </p>
                <button
                  onClick={() => setPdfContext(null)}
                  className="ml-2 text-gray-500 hover:text-gray-900"
                >
                  <XCircle size={16} />
                </button>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
              <label
                htmlFor="pdf-upload"
                className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <FileUp size={20} className="text-gray-600" />
                <input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleChatSubmit()
                }
                placeholder="Ask me anything..."
                className="flex-1 w-full bg-gray-50 text-gray-900 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 border border-gray-100"
                disabled={isGenerating}
              />
              <button
                onClick={handleChatSubmit}
                disabled={isGenerating || !userInput.trim()}
                className="bg-purple-600 text-white p-2 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowUp size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
