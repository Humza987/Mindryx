"use client";

import { useState, useEffect } from "react";
import { Clock, Trophy, BookOpen, ChevronRight } from "lucide-react";
import { useUser } from "@clerk/nextjs";

interface PastQuiz {
  quizId: string;
  topic: string;
  difficulty: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  submittedAt: string;
  status: string;
}

interface PastQuizzesResponse {
  pastQuizzes: PastQuiz[];
  count: number;
  userId: string;
}

export default function PastQuizzesPage() {
  const { user, isLoaded } = useUser();
  const [pastQuizzes, setPastQuizzes] = useState<PastQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;

    const loadPastQuizzes = async () => {
      try {
        const response = await fetch(`/api/getPastQuizzes`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load past quizzes: ${response.status}`);
        }

        const data: PastQuizzesResponse = await response.json();
        console.log("Past quizzes data:", data);

        setPastQuizzes(data.pastQuizzes || []);
        setLoading(false);
      } catch (error) {
        console.error("Error loading past quizzes:", error);
        setError("Failed to load past quizzes");
        setLoading(false);
      }
    };

    loadPastQuizzes();
  }, [isLoaded, user]);

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

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
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

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-800">Loading your quiz history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-800 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Your Quiz History
          </h1>
          <p className="text-gray-700 text-lg">
            Review your completed quizzes and track your progress
          </p>
        </div>

        {pastQuizzes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              No Quizzes Yet
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              You haven't completed any quizzes yet. Start taking quizzes to see
              your progress here!
            </p>
            <button
              onClick={() => (window.location.href = "/quiz/new")}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg text-lg transition-colors duration-200"
            >
              Take Your First Quiz
            </button>
          </div>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Total Quizzes
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                      {pastQuizzes.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Average Score
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                      {pastQuizzes.length > 0
                        ? Math.round(
                            pastQuizzes.reduce(
                              (sum, quiz) => sum + quiz.percentage,
                              0
                            ) / pastQuizzes.length
                          )
                        : 0}
                      %
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Best Score
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                      {pastQuizzes.length > 0
                        ? Math.max(
                            ...pastQuizzes.map((quiz) => quiz.percentage)
                          )
                        : 0}
                      %
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quiz List */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Recent Quizzes ({pastQuizzes.length})
                </h2>
              </div>

              <div className="divide-y divide-gray-200">
                {pastQuizzes.map((quiz) => (
                  <div
                    key={quiz.quizId}
                    onClick={() =>
                      (window.location.href = `/past-quizzes/${quiz.quizId}`)
                    }
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-colors duration-200 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-4 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {quiz.topic}
                          </h3>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(
                              quiz.difficulty
                            )}`}
                          >
                            {quiz.difficulty}
                          </span>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Trophy className="w-4 h-4" />
                            <span
                              className={`font-medium ${getScoreColor(
                                quiz.percentage
                              )}`}
                            >
                              {quiz.score}/{quiz.totalQuestions} (
                              {quiz.percentage}%)
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{formatDate(quiz.submittedAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div
                            className={`text-2xl font-bold ${getScoreColor(
                              quiz.percentage
                            )}`}
                          >
                            {quiz.percentage}%
                          </div>
                          <div className="text-sm text-gray-500">
                            {quiz.score}/{quiz.totalQuestions}
                          </div>
                        </div>

                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 text-center space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
              <button
                onClick={() => (window.location.href = "/quiz/new")}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg text-lg transition-colors duration-200"
              >
                Take New Quiz
              </button>

              <button
                onClick={() => (window.location.href = "/")}
                className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg text-lg transition-colors duration-200"
              >
                Back to Home
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
