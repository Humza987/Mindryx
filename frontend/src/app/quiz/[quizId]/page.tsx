"use client";

import { useState, useEffect } from "react";
import { useUser, useSession } from "@clerk/nextjs";
import { CheckCircle, XCircle } from "lucide-react";

interface QuizOption {
  id: string;
  text: string;
  correct: boolean;
}

interface QuizQuestion {
  id?: string;
  text: string;
  options: QuizOption[];
}

interface QuizData {
  id: string;
  topic: string;
  difficulty: string;
  quiz: QuizQuestion[];
  user_id: string;
  created_at: string;
}

interface PageProps {
  params: Promise<{ quizId: string }>;
}

export default function QuizPage({ params }: PageProps) {
  const { user } = useUser();
  const { session } = useSession();

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [percentage, setPercentage] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [quizId, setQuizId] = useState<string>("");

  useEffect(() => {
    const initializeParams = async () => {
      try {
        const resolvedParams = await params;
        setQuizId(resolvedParams.quizId);
      } catch (error) {
        console.error("Error resolving params:", error);
        setError("Failed to load quiz parameters");
        setLoading(false);
      }
    };

    initializeParams();
  }, [params]);

  useEffect(() => {
    if (!session || !quizId) return;

    const pollQuiz = async () => {
      try {
        const res = await fetch(`/api/getQuiz?quizId=${quizId}`);
        const result = await res.json();

        if (result.error) {
          setError(result.error);
          setLoading(false);
          return;
        }

        if (!result.data) {
          setLoading(true);
          return;
        }

        const transformedQuiz: QuizData = {
          ...result.data,
          quiz: result.data.quiz.map((q: any, idx: number) => ({
            ...q,
            id: idx.toString(),
          })),
        };

        setQuiz(transformedQuiz);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching quiz:", err);
        setError("Failed to load quiz. Please try again.");
        setLoading(false);
      }
    };

    pollQuiz();
    const interval = setInterval(pollQuiz, 5000);
    return () => clearInterval(interval);
  }, [quizId, session]);

  const handleAnswerChange = (questionId: string, optionId: string) => {
    if (isSubmitted) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = async () => {
    if (!quiz || !user) return;
    setIsSubmitting(true);
    setError("");

    try {
      if (!user) throw new Error("User not signed in");
      if (!session) throw new Error("Session missing - please sign in");

      const clerkToken = await session.getToken();
      if (!clerkToken) {
        setError("Unauthorized: token missing. Please sign in again.");
        setIsSubmitting(false);
        return;
      }

      const EDGE_FN_URL =
        (process.env.NEXT_PUBLIC_SUPABASE_URL ??
          "https://mgdznamahtskczereiib.supabase.co") +
        "/functions/v1/submit_answers";

      const res = await fetch(EDGE_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${clerkToken}`,
        },
        body: JSON.stringify({
          quizId: quiz.id,
          answers,
        }),
      });

      if (res.status === 401) {
        setError(
          "Unauthorized: token missing or invalid. Please sign in again."
        );
        setIsSubmitting(false);
        return;
      }

      const data = await res.json();

      if (res.status !== 200 || data.error) {
        throw new Error(data.error || "Failed to submit quiz");
      }

      setScore(data.score);
      setTotalQuestions(data.totalQuestions);
      setPercentage(data.percentage);
      setIsSubmitted(true);
    } catch (err: any) {
      console.error("Failed to submit quiz:", err);
      setError(err.message || "Failed to submit quiz. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getOptionStatus = (question: QuizQuestion, option: QuizOption) => {
    if (!isSubmitted) return null;
    const userAnswer = answers[question.id!];
    const isSelected = userAnswer === option.id;
    const isCorrect = option.correct;
    if (isCorrect) return "correct";
    if (isSelected && !isCorrect) return "incorrect";
    return null;
  };

  const getQuestionStatus = (question: QuizQuestion) => {
    if (!isSubmitted) return null;
    const userAnswer = answers[question.id!];
    const correctOption = question.options.find((o) => o.correct);
    return userAnswer === correctOption?.id ? "correct" : "incorrect";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-black">Loading your quiz…</p>
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-black mb-4">
            {error || "Quiz Not Found"}
          </h2>
          <button
            onClick={() => (window.location.href = "/quiz/new")}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg"
          >
            Create New Quiz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-2 text-black">
          {quiz.topic} Quiz
        </h1>
        <p className="text-center text-black capitalize mb-8">
          Difficulty: {quiz.difficulty} • {quiz.quiz.length} Questions
        </p>

        {quiz.quiz.map((question, idx) => {
          const questionStatus = getQuestionStatus(question);
          return (
            <div
              key={question.id}
              className={`p-6 rounded-lg border-2 mb-6 ${
                isSubmitted
                  ? questionStatus === "correct"
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <h3 className="text-lg font-semibold mb-3 text-black">
                {idx + 1}. {question.text}
              </h3>
              <div className="space-y-3">
                {question.options.map((option) => {
                  const optionStatus = getOptionStatus(question, option);
                  const isSelected = answers[question.id!] === option.id;
                  return (
                    <label
                      key={option.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSubmitted
                          ? optionStatus === "correct"
                            ? "bg-green-100 border-green-300 text-green-900"
                            : optionStatus === "incorrect"
                            ? "bg-red-100 border-red-300 text-red-900"
                            : isSelected
                            ? "bg-gray-100 border-gray-300 text-black"
                            : "bg-white border-gray-200 text-black"
                          : isSelected
                          ? "bg-blue-50 border-blue-300 text-black"
                          : "bg-white border-gray-200 hover:bg-gray-50 text-black"
                      } ${isSubmitted ? "cursor-default" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={option.id}
                        checked={isSelected}
                        onChange={() =>
                          handleAnswerChange(question.id!, option.id)
                        }
                        disabled={isSubmitted}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="flex-1 text-black">{option.text}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!isSubmitted && (
          <div className="mt-8 text-center">
            <button
              onClick={handleSubmit}
              disabled={
                isSubmitting || Object.keys(answers).length < quiz.quiz.length
              }
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-8 rounded-lg text-lg"
            >
              {isSubmitting ? "Submitting…" : "Submit Quiz"}
            </button>
          </div>
        )}

        {isSubmitted && (
          <div className="mt-8 text-center">
            <p className="text-2xl mb-4 text-black">
              🎉 You scored {score} / {totalQuestions} ({percentage}%)
            </p>
            <button
              onClick={() => (window.location.href = "/quiz/new")}
              className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-8 rounded-lg text-lg"
            >
              Create New Quiz
            </button>
          </div>
        )}
      </div>
    </div>
  );
}