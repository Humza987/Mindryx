'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

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
  quizId: string;
  topic: string;
  difficulty: string;
  questions: QuizQuestion[];
  userId: string;
  status: string;
}

export default function QuizPage({ params }: { params: { quizId: string } }) {
  const API_ID = process.env.NEXT_PUBLIC_API_ID;

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [percentage, setPercentage] = useState<number>(0);

  useEffect(() => {
    const loadQuiz = async () => {
      try {
        const userId = localStorage.getItem('userId') || 'anonymous';
        
        const response = await fetch(
          `http://localhost:4566/restapis/${API_ID}/dev/_user_request_/quiz/${params.quizId}?userId=${userId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to load quiz: ${response.status}`);
        }

        const data = await response.json();
        console.log('Quiz data:', data);

        // Fixed: data.quiz instead of data.quiz.quiz
        const transformedQuiz: QuizData = {
          quizId: data.quizId,
          topic: data.topic,
          difficulty: data.difficulty,
          userId: data.userId,
          status: data.status,
          questions: data.quiz.map((question: any, index: number) => ({
            id: index.toString(),
            text: question.text,
            options: question.options
          }))
        };

        setQuiz(transformedQuiz);
        setLoading(false);
      } catch (error) {
        console.error('Error loading quiz:', error);
        setLoading(false);
      }
    };

    loadQuiz();
  }, [params.quizId]);

  const handleAnswerChange = (questionId: string, optionId: string) => {
    if (isSubmitted) return;
    
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionId
    }));
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    
    setIsSubmitting(true);
    
    try {
      const userId = localStorage.getItem('userId') || 'anonymous';
      
      const response = await fetch(
        `http://localhost:4566/restapis/${API_ID}/dev/_user_request_/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: userId,
            quizId: quiz.quizId,
            answers: answers
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to submit quiz: ${response.status}`);
      }

      const result = await response.json();
      console.log('Submit result:', result);
      
      setScore(result.score);
      setTotalQuestions(result.totalQuestions);
      setPercentage(result.percentage);
      setIsSubmitted(true);
      
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      alert('Failed to submit quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getOptionStatus = (question: QuizQuestion, option: QuizOption) => {
    if (!isSubmitted) return null;
    
    const userAnswer = answers[question.id!];
    const isSelected = userAnswer === option.id;
    const isCorrect = option.correct;
    
    if (isCorrect) return 'correct';
    if (isSelected && !isCorrect) return 'incorrect';
    return null;
  };

  const getQuestionStatus = (question: QuizQuestion) => {
    if (!isSubmitted) return null;
    
    const userAnswer = answers[question.id!];
    const correctOption = question.options.find(opt => opt.correct);
    return userAnswer === correctOption?.id ? 'correct' : 'incorrect';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-800">Loading your quiz...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Quiz Not Found</h2>
          <p className="text-gray-800 mb-6">The quiz you're looking for doesn't exist or failed to load.</p>
          <button
            onClick={() => window.location.href = '/quiz/new'}
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
            {quiz.topic} Quiz
          </h1>
          <p className="text-center text-gray-800 capitalize">
            Difficulty: {quiz.difficulty} • {quiz.questions.length} Questions
          </p>
        </div>

        {isSubmitted && score !== null && (
          <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-center">
              <div className="text-4xl mb-2">🎉</div>
              <h2 className="text-2xl font-bold text-green-900 mb-2">
                Quiz Complete!
              </h2>
              <p className="text-xl text-green-900">
                You scored <span className="font-bold">{score}</span> out of{' '}
                <span className="font-bold">{totalQuestions}</span>
              </p>
              <p className="text-green-800 mt-2">
                ({percentage}%)
              </p>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {quiz.questions.map((question, index) => {
            const questionStatus = getQuestionStatus(question);
            
            return (
              <div
                key={question.id}
                className={`p-6 rounded-lg border-2 transition-colors ${
                  isSubmitted
                    ? questionStatus === 'correct'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3 mb-4">
                  {isSubmitted && (
                    <div className="flex-shrink-0 mt-1">
                      {questionStatus === 'correct' ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-600" />
                      )}
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-gray-900">
                    {index + 1}. {question.text}
                  </h3>
                </div>

                <div className="space-y-3 ml-9">
                  {question.options.map((option) => {
                    const optionStatus = getOptionStatus(question, option);
                    const isSelected = answers[question.id!] === option.id;
                    
                    return (
                      <label
                        key={option.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSubmitted
                            ? optionStatus === 'correct'
                              ? 'bg-green-100 border-green-300 text-green-900'
                              : optionStatus === 'incorrect'
                              ? 'bg-red-100 border-red-300 text-red-900'
                              : isSelected
                              ? 'bg-gray-100 border-gray-300'
                              : 'bg-white border-gray-200'
                            : isSelected
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        } ${isSubmitted ? 'cursor-default' : ''}`}
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={option.id}
                          checked={isSelected}
                          onChange={() => handleAnswerChange(question.id!, option.id)}
                          disabled={isSubmitted}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="flex-1 text-gray-900">{option.text}</span>
                        
                        {isSubmitted && (
                          <div className="flex items-center gap-2">
                            {optionStatus === 'correct' && (
                              <>
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <span className="text-sm font-medium text-green-900">
                                  Correct
                                </span>
                              </>
                            )}
                            {optionStatus === 'incorrect' && (
                              <>
                                <XCircle className="w-5 h-5 text-red-600" />
                                <span className="text-sm font-medium text-red-900">
                                  Your answer
                                </span>
                              </>
                            )}
                            {option.correct && !isSelected && isSubmitted && (
                              <span className="text-sm font-medium text-green-900">
                                ← Correct answer
                              </span>
                            )}
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {!isSubmitted && (
          <div className="mt-8 text-center">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || Object.keys(answers).length < quiz.questions.length}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-8 rounded-lg text-lg transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Submitting...</span>
                </div>
              ) : (
                'Submit Quiz'
              )}
            </button>
            
            {Object.keys(answers).length < quiz.questions.length && (
              <p className="text-sm text-gray-700 mt-2">
                Please answer all questions before submitting
              </p>
            )}
          </div>
        )}

        {isSubmitted && (
          <div className="mt-8 text-center">
            <button
              onClick={() => window.location.href = '/quiz/new'}
              className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-8 rounded-lg text-lg transition-colors duration-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Create New Quiz
            </button>
          </div>
        )}
      </div>
    </div>
  );
}