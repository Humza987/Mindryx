"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  CheckCircle,
  XCircle,
  ArrowLeft,
  Trophy,
  Clock,
  BookOpen,
} from "lucide-react";

// Simplified interfaces for clarity
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

interface PastQuizData {
  quizId: string;
  topic: string;
  difficulty: string;
  quiz: QuizQuestion[]; // The questions array is now at the top level
  userAnswers: Record<string, string>;
  score: number;
  totalQuestions: number;
  percentage: number;
  submittedAt: string;
}

interface PageProps {
  params: Promise<{ quizId: string }>;
}

export default function PastQuizDetailsPage({ params }: PageProps) {
  const { user, isLoaded } = useUser();
  const [pastQuiz, setPastQuiz] = useState<PastQuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    // Wait for the user to be loaded and quizId to be available before fetching data
    if (!isLoaded || !user || !quizId) return;

    const loadPastQuiz = async () => {
      try {
        // Fetch from the new local API route
        const response = await fetch(`/api/getPastQuiz/${quizId}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `Failed to load past quiz: ${response.status}`
          );
        }

        const data: PastQuizData = await response.json();
        setPastQuiz(data);
      } catch (error: any) {
        console.error("Error loading past quiz:", error);
        setError(error.message || "Failed to load quiz details");
      } finally {
        setLoading(false);
      }
    };

    loadPastQuiz();
  }, [quizId, isLoaded, user]);

  const formatDate = (dateString: string) => {
    if (!dateString) return "Unknown date";

    try {
      // Remove microseconds if present (JS only supports milliseconds)
      let normalizedDateString = dateString.replace(/\.(\d{3})\d+/, ".$1");

      // Ensure timezone offset is in a format JS can handle
      if (
        normalizedDateString.endsWith("Z") === false &&
        /\+\d{2}:\d{2}/.test(normalizedDateString)
      ) {
        // Keep as-is, JS can parse '+00:00' offsets
      } else if (
        normalizedDateString.includes("T") &&
        !normalizedDateString.endsWith("Z")
      ) {
        normalizedDateString += "Z"; // Assume UTC if no timezone
      }

      const date = new Date(normalizedDateString);

      if (isNaN(date.getTime())) return "Invalid date";

      const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      };

      return date.toLocaleDateString("en-US", options);
    } catch (error) {
      console.error("Date parsing error:", error);
      return "Invalid date";
    }
  };

  // Helper to safely get the user's answer for a question.
  // Uses question.id when available, otherwise falls back to the stringified index.
  const getUserAnswer = (question: QuizQuestion, index: number) => {
    if (!pastQuiz) return undefined;
    if (question.id && pastQuiz.userAnswers.hasOwnProperty(question.id)) {
      return pastQuiz.userAnswers[question.id];
    }
    const idxKey = String(index);
    return pastQuiz.userAnswers.hasOwnProperty(idxKey)
      ? pastQuiz.userAnswers[idxKey]
      : undefined;
  };

  // Returns 'correct' if the option is the correct answer (highlight correct option)
  // Returns 'incorrect' only if the user selected this option and it's wrong
  const getOptionStatus = (
    question: QuizQuestion,
    option: QuizOption,
    index: number
  ) => {
    const userAnswer = getUserAnswer(question, index);
    const isSelected = userAnswer === option.id;
    const isCorrect = option.correct;

    if (isCorrect) return "correct";
    if (isSelected && !isCorrect) return "incorrect";
    return null;
  };

  // Returns 'correct' if the user's selected option matches the correct option id
  const getQuestionStatus = (question: QuizQuestion, index: number) => {
    const userAnswer = getUserAnswer(question, index);
    const correctOption = question.options.find((opt) => opt.correct);
    return userAnswer === correctOption?.id ? "correct" : "incorrect";
  };

  const isOptionSelected = (
    question: QuizQuestion,
    option: QuizOption,
    index: number
  ) => {
    return getUserAnswer(question, index) === option.id;
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case "easy":
        return "bg-green-100 text-green-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "hard":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading || !isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-800">Loading quiz details...</p>
        </div>
      </div>
    );
  }

  if (error || !pastQuiz) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-center px-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {error || "Quiz Not Found"}
          </h2>
          <p className="text-gray-800 mb-6">
            The quiz details could not be loaded or you may not have access.
          </p>
          <div className="space-y-2 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
            <button
              onClick={() => (window.location.href = "/past-quizzes")}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg"
            >
              Back to Past Quizzes
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-6 rounded-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Use the simplified path to questions
  const questions = pastQuiz.quiz || [];

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <button
            onClick={() => (window.location.href = "/past-quizzes")}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Past Quizzes
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {pastQuiz.topic} Quiz
              </h1>
              <div className="flex items-center gap-4 flex-wrap">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(
                    pastQuiz.difficulty
                  )}`}
                >
                  {pastQuiz.difficulty}
                </span>
                <div className="flex items-center gap-1 text-gray-600">
                  <BookOpen className="w-4 h-4" />
                  <span>{pastQuiz.totalQuestions} Questions</span>
                </div>
                <div className="flex items-center gap-1 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>{formatDate(pastQuiz.submittedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Score Summary */}
        <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Trophy className="w-8 h-8 text-yellow-500" />
              <h2 className="text-2xl font-bold text-gray-900">Your Results</h2>
            </div>
            <div
              className={`text-5xl font-bold mb-2 ${getScoreColor(
                pastQuiz.percentage
              )}`}
            >
              {pastQuiz.percentage}%
            </div>
            <p className="text-xl text-gray-700">
              You scored <span className="font-bold">{pastQuiz.score}</span> out
              of <span className="font-bold">{pastQuiz.totalQuestions}</span>{" "}
              questions correctly
            </p>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${
                    pastQuiz.percentage >= 80
                      ? "bg-green-500"
                      : pastQuiz.percentage >= 60
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${pastQuiz.percentage}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Questions and Answers Review */}
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">
            Review Your Answers
          </h3>
          <div className="space-y-8">
            {questions.map((question, index) => {
              const questionStatus = getQuestionStatus(question, index);
              return (
                <div
                  key={question.id || index}
                  className={`p-6 rounded-lg border-2 transition-colors ${
                    questionStatus === "correct"
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="flex-shrink-0 mt-1">
                      {questionStatus === "correct" ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-600" />
                      )}
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">
                      {index + 1}. {question.text}
                    </h4>
                  </div>

                  <div className="space-y-3 ml-9">
                    {question.options.map((option) => {
                      const optionStatus = getOptionStatus(
                        question,
                        option,
                        index
                      );
                      const isSelected = isOptionSelected(
                        question,
                        option,
                        index
                      );
                      return (
                        <div
                          key={option.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            optionStatus === "correct"
                              ? "bg-green-100 border-green-300 text-green-900"
                              : optionStatus === "incorrect"
                              ? "bg-red-100 border-red-300 text-red-900"
                              : "bg-white border-gray-200"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q-${index}`}
                            value={option.id}
                            checked={isSelected}
                            disabled
                            className="w-4 h-4"
                          />
                          <span className="flex-1">{option.text}</span>
                          {optionStatus === "correct" && (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          )}
                          {optionStatus === "incorrect" && (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => (window.location.href = "/quiz/new")}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg text-lg transition-colors duration-200"
            >
              Take New Quiz
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}