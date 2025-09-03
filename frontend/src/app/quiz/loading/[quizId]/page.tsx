"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/utils/supabase-provider";
import { useUser } from "@clerk/nextjs";

interface PageProps {
  params: Promise<{ quizId: string }>;
}

export default function QuizLoading({ params }: PageProps) {
  const { supabase, isLoaded } = useSupabase();
  const { user } = useUser();

  const [loadingMessage, setLoadingMessage] = useState(
    "Generating your quiz… this might take a minute. Hang tight!"
  );
  const [progressDots, setProgressDots] = useState("");
  const [error, setError] = useState<string>("");
  const [quizId, setQuizId] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    const initializeParams = async () => {
      try {
        const resolvedParams = await params;
        setQuizId(resolvedParams.quizId);
      } catch (error) {
        console.error("Error resolving params:", error);
        setError("Failed to load quiz parameters");
      }
    };

    initializeParams();
  }, [params]);

  useEffect(() => {
    if (!isLoaded || !supabase || !user || !quizId) return;

    const interval = setInterval(() => {
      setProgressDots((prev) => (prev.length < 3 ? prev + "." : ""));
    }, 500);

    const pollQuiz = async () => {
      try {
        const res = await fetch(`/api/getQuiz?quizId=${quizId}`);
        const result = await res.json();

        if (!result.data) {
          setLoadingMessage("AI is crafting your questions...");
          return;
        }

        console.log("Quiz ready:", result.data);
        router.replace(`/quiz/${quizId}`);
      } catch (err) {
        console.error("Error polling quiz:", err);
        setError("Having trouble connecting. Please wait...");
        setLoadingMessage("Having trouble connecting. Please wait...");
      }
    };

    // Initial poll
    pollQuiz();

    // Poll every 5 seconds ✅
    const pollInterval = setInterval(pollQuiz, 5000);

    return () => {
      clearInterval(interval);
      clearInterval(pollInterval);
    };
  }, [quizId, router, supabase, isLoaded, user]);

  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
        <div className="bg-white shadow-lg rounded-xl p-8 max-w-md text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="bg-white shadow-lg rounded-xl p-8 max-w-md text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">
          Your Quiz is on its Way!
        </h1>
        <p className="text-gray-900 mb-6">
          {loadingMessage}
          <span>{progressDots}</span>
        </p>
        <div className="flex justify-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-sm text-gray-700 mt-4">
          AI is carefully generating questions for you. Almost there…
        </p>
        {quizId && (
          <p className="text-xs text-gray-600 mt-2">Quiz ID: {quizId}</p>
        )}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => (window.location.href = "/quiz/new")}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Try creating a new quiz
            </button>
          </div>
        )}
      </div>
    </div>
  );
}