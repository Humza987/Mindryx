'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function QuizLoading() {
  const API_ID = process.env.NEXT_PUBLIC_API_ID;

  const [loadingMessage, setLoadingMessage] = useState(
    "Generating your quiz… this might take a minute. Hang tight!"
  );
  const [progressDots, setProgressDots] = useState('');
  const router = useRouter();
  const params = useParams();
  const quizId = params.quizId;

  useEffect(() => {
    const interval = setInterval(() => {
      setProgressDots((prev) => (prev.length < 3 ? prev + '.' : ''));
    }, 500);

    const pollQuiz = async () => {
      if (!quizId) return;
      
      try {
        const userId = localStorage.getItem('userId') || 'anonymous';
        
        const res = await fetch(
          `http://localhost:4566/restapis/${API_ID}/dev/_user_request_/quiz/${quizId}?userId=${userId}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        if (res.ok) {
          const data = await res.json();
          console.log('Quiz poll result:', data);
          
          if (data.status === 'READY') {
            console.log('Quiz is ready! Redirecting...');
            router.replace(`/quiz/${quizId}`);
          } else {
            console.log('Quiz not ready yet, status:', data.status);
            if (data.status === 'GENERATING') {
              setLoadingMessage("AI is crafting your questions...");
            } else if (data.status === 'PROCESSING') {
              setLoadingMessage("Finalizing your quiz...");
            }
          }
        } else {
          console.error('Failed to fetch quiz:', res.status, res.statusText);
          if (res.status === 404) {
            setLoadingMessage("Quiz not found. Please try creating a new one.");
          }
        }
      } catch (err) {
        console.error('Error polling quiz:', err);
        setLoadingMessage("Having trouble connecting. Please wait...");
      }
    };

    const pollInterval = setInterval(pollQuiz, 2000);
    pollQuiz();

    return () => {
      clearInterval(interval);
      clearInterval(pollInterval);
    };
  }, [quizId, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="bg-white shadow-lg rounded-xl p-8 max-w-md text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Your Quiz is on its Way!</h1>
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
          <p className="text-xs text-gray-600 mt-2">
            Quiz ID: {quizId}
          </p>
        )}
      </div>
    </div>
  );
}