"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import React from "react"; // Add this import

// Simplest solution: Remove explicit return type
export default function Home() {
  const { user } = useUser();

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 bg-slate-50">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl p-8 text-left transform transition duration-300 hover:scale-[1.01]">
        <header className="mb-6">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight text-center">
            Mindryx
            <span className="text-blue-600"> — Study Smarter</span>
          </h1>

          <p className="mt-2 text-gray-600">
            Quickly create practice quizzes from topics or PDFs, review results,
            and interact with an in-browser AI assistant — all designed as a
            learning playground for serverless architecture and AI integrations.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-2">
              Create from Topic
            </h3>
            <p className="text-sm text-gray-600">
              Enter a topic and generate multiple-choice quizzes (choose
              difficulty & number of questions).
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-2">
              PDF Upload & OCR
            </h3>
            <p className="text-sm text-gray-600">
              Upload PDFs — text is extracted (or OCR is used when needed) so AI
              can generate questions from your own notes and readings.
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-2">
              In-Browser Chat (WebLLM)
            </h3>
            <p className="text-sm text-gray-600">
              Use an in-browser LLM for unlimited interactive Q&A and follow-ups
              without sending your document to the cloud.
            </p>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Why this exists
          </h2>
          <p className="text-gray-700 text-sm">
            Many existing quiz & AI services impose strict file, API or usage
            limits which frustrate students trying to study from large notes or
            PDFs. This project is a hobby learning tool that aims to reduce
            those friction points by:
          </p>
          <ul className="mt-3 list-disc list-inside text-gray-600 text-sm space-y-1">
            <li>
              Using local OCR + text extraction so documents can be prepared for
              AI without costly uploads.
            </li>
            <li>
              Leveraging Gemini LLM for affordable/free quiz generation while
              offering an in-browser model for unlimited local chat.
            </li>
            <li>
              Made with NextJS, Clerk Auth, Supabase, Gemini Flash LLM, and
              experimental WebLLM integration, and Sandbox Stripe Integration
              for learning{" "}
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-3">
            Quick actions
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/quiz/new"
              className="inline-flex items-center justify-center bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              🚀 Start a Quiz
            </Link>

            <Link
              href="/chatbot"
              className="inline-flex items-center justify-center border border-gray-200 px-5 py-3 rounded-lg hover:bg-gray-50 transition text-gray-800"
            >
              🧠 Try Local AI Chat - Powered by WebLLM
            </Link>
          </div>
        </section>

        <section
          id="getting-started"
          className="mt-4 pt-4 border-t border-gray-100"
        >
          <p className="text-xs text-gray-500 mt-2">
            See the repo README for environment variables, motivation, and
            architecture notes. This project is intentionally a playground for
            learning serverless concepts with minimal cost.
          </p>
        </section>

        <footer className="mt-6 text-sm text-gray-500">
          <div>
            Made as a learning project. Contributions, questions, and ideas
            welcome.
          </div>
        </footer>
      </div>
    </div>
  );
}
