'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, ArrowLeft, Trophy, Clock, BookOpen } from 'lucide-react';

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
  quiz: {
    quiz: QuizQuestion[];
  };
  userAnswers: Record<string, string>;
  score: number;
  totalQuestions: number;
  percentage: number;
  submittedAt: string;
  userId: string;
  status: string;
}

export default function PastQuizDetailsPage({ params }: { params: { quizId: string } }) {
  const API_ID = process.env.NEXT_PUBLIC_API_ID;

  const [pastQuiz, setPastQuiz] = useState<PastQuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPastQuiz = async () => {
      try {
        const userId = localStorage.getItem('userId') || 'anonymous';
        
        const response = await fetch(
          `http://localhost:4566/restapis/${API_ID}/dev/_user_request_/past-quiz/${params.quizId}?userId=${userId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to load past quiz: ${response.status}`);
        }

        const data = await response.json();
        console.log('Past quiz data:', data);
        console.log('User answers:', data.userAnswers);
        
        // Log each question and its options for debugging
        if (data.quiz?.quiz) {
          data.quiz.quiz.forEach((q: QuizQuestion, idx: number) => {
            console.log(`Question ${idx}:`, {
              id: q.id,
              text: q.text,
              options: q.options.map(opt => ({ id: opt.id, text: opt.text, correct: opt.correct }))
            });
          });
        }

        setPastQuiz(data);
        setLoading(false);
      } catch (error) {
        console.error('Error loading past quiz:', error);
        setError('Failed to load quiz details');
        setLoading(false);
      }
    };

    loadPastQuiz();
  }, [params.quizId, API_ID]);

const formatDate = (dateString: string) => {
  if (!dateString) return 'Unknown date';
  
  try {
    let date: Date;
    
    if (dateString.endsWith('Z')) {
      // Already has UTC marker
      date = new Date(dateString);
    } else if (dateString.includes('T') && !dateString.endsWith('Z')) {
      // ISO format but missing Z
      date = new Date(dateString + 'Z');
    } else if (dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      // "YYYY-MM-DD HH:mm:ss" format - FORCE as UTC
      date = new Date(dateString.replace(' ', 'T') + 'Z');
    } else if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Just date - assume midnight UTC
      date = new Date(dateString + 'T00:00:00Z');
    } else {
      // Last resort - try to force UTC
      date = new Date(dateString + (dateString.includes('T') ? 'Z' : 'T00:00:00Z'));
    }
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    
    // Format the date in the user's local timezone
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    };
    
    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error('Date parsing error:', error);
    return 'Invalid date';
  }
};

  const getOptionStatus = (question: QuizQuestion, option: QuizOption, questionIndex: number) => {
    // Try multiple possible question ID formats
    const possibleQuestionIds = [
      question.id,
      questionIndex.toString(),
      `q${questionIndex}`,
      `question-${questionIndex}`
    ].filter(Boolean);

    // Find which question ID was actually used in userAnswers
    let userAnswer = '';
    let usedQuestionId = '';
    
    for (const qId of possibleQuestionIds) {
      if (pastQuiz?.userAnswers[qId!] !== undefined) {
        userAnswer = pastQuiz.userAnswers[qId!];
        usedQuestionId = qId!;
        break;
      }
    }

    console.log(`Question ${questionIndex}:`, {
      possibleIds: possibleQuestionIds,
      usedId: usedQuestionId,
      userAnswer,
      optionId: option.id,
      optionCorrect: option.correct
    });

    const isSelected = userAnswer === option.id || userAnswer === option.text;
    const isCorrect = option.correct;
    
    if (isCorrect) return 'correct';
    if (isSelected && !isCorrect) return 'incorrect';
    return null;
  };

  const getQuestionStatus = (question: QuizQuestion, questionIndex: number) => {

    const possibleQuestionIds = [
      question.id,
      questionIndex.toString(),
      `q${questionIndex}`,
      `question-${questionIndex}`
    ].filter(Boolean);

    let userAnswer = '';
    for (const qId of possibleQuestionIds) {
      if (pastQuiz?.userAnswers[qId!] !== undefined) {
        userAnswer = pastQuiz.userAnswers[qId!];
        break;
      }
    }

    const correctOption = question.options.find(opt => opt.correct);
    
    // Check if user answer matches correct option by ID or text
    const isCorrect = userAnswer === correctOption?.id || userAnswer === correctOption?.text;
    
    return isCorrect ? 'correct' : 'incorrect';
  };

  const isOptionSelected = (question: QuizQuestion, option: QuizOption, questionIndex: number) => {
    // Try multiple possible question ID formats
    const possibleQuestionIds = [
      question.id,
      questionIndex.toString(),
      `q${questionIndex}`,
      `question-${questionIndex}`
    ].filter(Boolean);

    let userAnswer = '';
    for (const qId of possibleQuestionIds) {
      if (pastQuiz?.userAnswers[qId!] !== undefined) {
        userAnswer = pastQuiz.userAnswers[qId!];
        break;
      }
    }

    // Match by ID or text
    return userAnswer === option.id || userAnswer === option.text;
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {error || 'Quiz Not Found'}
          </h2>
          <p className="text-gray-800 mb-6">
            The quiz details could not be loaded.
          </p>
          <div className="space-y-2 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
            <button
              onClick={() => window.location.href = '/past-quizzes'}
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

  const questions = pastQuiz.quiz?.quiz || [];

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <button
            onClick={() => window.location.href = '/past-quizzes'}
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
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(pastQuiz.difficulty)}`}>
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
            <div className={`text-5xl font-bold mb-2 ${getScoreColor(pastQuiz.percentage)}`}>
              {pastQuiz.percentage}%
            </div>
            <p className="text-xl text-gray-700">
              You scored <span className="font-bold">{pastQuiz.score}</span> out of{' '}
              <span className="font-bold">{pastQuiz.totalQuestions}</span> questions correctly
            </p>
            
            {/* Performance indicator */}
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 ${
                    pastQuiz.percentage >= 80 ? 'bg-green-500' : 
                    pastQuiz.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
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

        {/* Questions and Answers */}
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
                    questionStatus === 'correct'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="flex-shrink-0 mt-1">
                      {questionStatus === 'correct' ? (
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
                      const optionStatus = getOptionStatus(question, option, index);
                      const isSelected = isOptionSelected(question, option, index);
                      
                      return (
                        <div
                          key={option.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            optionStatus === 'correct'
                              ? 'bg-green-100 border-green-300 text-green-900'
                              : optionStatus === 'incorrect'
                              ? 'bg-red-100 border-red-300 text-red-900'
                              : isSelected
                              ? 'bg-gray-100 border-gray-300'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${question.id || index}`}
                            value={option.id}
                            checked={isSelected}
                            disabled
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="flex-1 text-gray-900">{option.text}</span>
                          
                          <div className="flex items-center gap-2">
                            {optionStatus === 'correct' && (
                              <>
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <span className="text-sm font-medium text-green-900">
                                  Correct Answer
                                </span>
                              </>
                            )}
                            {optionStatus === 'incorrect' && (
                              <>
                                <XCircle className="w-5 h-5 text-red-600" />
                                <span className="text-sm font-medium text-red-900">
                                  Your Answer
                                </span>
                              </>
                            )}
                            {option.correct && !isSelected && (
                              <span className="text-sm font-medium text-green-900">
                                ← Correct Answer
                              </span>
                            )}
                          </div>
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
      onClick={() => window.location.href = '/past-quizzes'}
      className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg text-lg transition-colors duration-200"
    >
      Back to Past Quizzes
    </button>
    
    <button
      onClick={() => window.location.href = '/quiz/new'}
      className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg text-lg transition-colors duration-200"
    >
      Take New Quiz
    </button>
    
    <button
      onClick={() => {
        const url = `/quiz/${pastQuiz.quizId}`;
        window.location.href = url;
      }}
      className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg text-lg transition-colors duration-200"
    >
      Retake This Quiz
    </button>
  </div>
</div>
      </div>
    </div>
  );
}