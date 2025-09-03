"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  BookOpen,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  AlertCircle,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";

interface OutstandingQuiz {
  quizId: string;
  topic: string;
  difficulty: string;
  createdAt: string;
}

interface OutstandingQuizzesResponse {
  outstandingQuizzes: OutstandingQuiz[];
  count: number;
  userId: string;
}

export default function OutstandingQuizzesPage() {
  const { user, isLoaded } = useUser();
  const [outstandingQuizzes, setOutstandingQuizzes] = useState<
    OutstandingQuiz[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOutstandingQuizzes = async (isRefresh = false) => {
    if (!isLoaded || !user) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const response = await fetch(`/api/getOutstandingQuizzes`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load outstanding quizzes: ${response.status}`
        );
      }

      const data: OutstandingQuizzesResponse = await response.json();
      console.log("Outstanding quizzes data:", data);

      setOutstandingQuizzes(data.outstandingQuizzes || []);
    } catch (error) {
      console.error("Error loading outstanding quizzes:", error);
      setError("Failed to load outstanding quizzes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isLoaded && user) {
      loadOutstandingQuizzes();
    }
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

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case "easy":
        return "bg-green-100 text-green-800 border-green-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "hard":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const handleQuizClick = (quizId: string) => {
    window.location.href = `/quiz/${quizId}`;
  };

  const handleRefresh = () => {
    loadOutstandingQuizzes(true);
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading outstanding quizzes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Outstanding Quizzes
              </h1>
              <p className="text-gray-600">
                Complete these quizzes that are waiting for you
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <button
                onClick={() => (window.location.href = "/quiz/new")}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
              >
                <PlusCircle className="w-4 h-4" />
                New Quiz
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <div>
                <h3 className="text-lg font-semibold text-red-900">Error</h3>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
            <button
              onClick={() => loadOutstandingQuizzes()}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Content */}
        {!error && (
          <>
            {/* Stats */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-sm p-6 mb-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-1">
                    {outstandingQuizzes.length}
                  </h2>
                  <p className="text-blue-100">
                    {outstandingQuizzes.length === 1
                      ? "Quiz Waiting"
                      : "Quizzes Waiting"}
                  </p>
                </div>
                <BookOpen className="w-12 h-12 text-blue-200" />
              </div>
            </div>

            {/* Quiz List */}
            {outstandingQuizzes.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No Outstanding Quizzes
                </h3>
                <p className="text-gray-600 mb-6">
                  You're all caught up! All your quizzes have been completed.
                </p>
                <button
                  onClick={() => (window.location.href = "/quiz/new")}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
                >
                  Create New Quiz
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {outstandingQuizzes.map((quiz) => (
                  <div
                    key={quiz.quizId}
                    className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
                    onClick={() => handleQuizClick(quiz.quizId)}
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {quiz.topic} Quiz
                            </h3>
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium border ${getDifficultyColor(
                                quiz.difficulty
                              )}`}
                            >
                              {quiz.difficulty}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>Created {formatDate(quiz.createdAt)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <BookOpen className="w-4 h-4" />
                              <span>Quiz ID: {quiz.quizId}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              Ready to Take
                            </p>
                            <p className="text-xs text-gray-600">
                              Click to start
                            </p>
                          </div>
                          <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-200" />
                        </div>
                      </div>
                    </div>

                    {/* Bottom border for visual separation */}
                    <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-b-xl"></div>
                  </div>
                ))}
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 text-center">
              <div className="inline-flex gap-4">
                <button
                  onClick={() => (window.location.href = "/past-quizzes")}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors duration-200"
                >
                  View Past Quizzes
                </button>
                <button
                  onClick={() => (window.location.href = "/")}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200"
                >
                  Back to Home
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
