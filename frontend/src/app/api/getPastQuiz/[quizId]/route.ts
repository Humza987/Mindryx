// src/app/api/getPastQuiz/[quizId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { currentUser } from "@clerk/nextjs/server";

// Initialize Supabase client (server-side)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Type definitions for better type safety
interface QuizData {
  topic: string;
  difficulty: string;
  quiz: any[];
}

interface ResultData {
  quiz_id: string;
  score: number;
  total_questions: number;
  percentage: number;
  submitted_at: string;
  answers: Record<string, any>;
  quizzes: QuizData | null;
}

/**
 * GET handler for /api/getPastQuiz/[quizId]
 * Notes:
 * - In Next.js 15, dynamic route handler params are asynchronous (Promise).
 * - We therefore type params as Promise<{ quizId: string }> and await it.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    // Await the async params and extract quizId
    const { quizId } = await params;

    // 1. Authenticate the user
    const user = await currentUser();
    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    // 2. Validate quizId
    if (!quizId) {
      return NextResponse.json(
        { error: "Quiz ID is required" },
        { status: 400 }
      );
    }

    // 3. Query the database for the specific quiz result for that user
    const { data, error } = await supabase
      .from("results")
      .select(`
        quiz_id,
        score,
        total_questions,
        percentage,
        submitted_at,
        answers,
        quizzes (
          topic,
          difficulty,
          quiz
        )
      `)
      .eq("user_id", userId)
      .eq("quiz_id", quizId)
      .single();

    // Handle query errors or if no quiz was found
    if (error || !data) {
      console.error("Supabase error or no data:", error);
      return NextResponse.json(
        { error: "Past quiz not found or you do not have permission to view it." },
        { status: 404 }
      );
    }

    // Type assertion to help TypeScript understand the structure
    const typedData = data as unknown as ResultData;

    // Handle the case where quizzes might be an array (Supabase foreign key relation)
    const quizData = Array.isArray(typedData.quizzes) 
      ? typedData.quizzes[0] 
      : typedData.quizzes;

    // 4. Format the data to match the frontend's expected structure
    const pastQuizDetails = {
      quizId: typedData.quiz_id,
      topic: quizData?.topic ?? "Unknown Topic",
      difficulty: quizData?.difficulty ?? "Unknown",
      quiz: quizData?.quiz ?? [],
      userAnswers: typedData.answers,
      score: typedData.score,
      totalQuestions: typedData.total_questions,
      percentage: Number.isFinite(Number(typedData.percentage))
        ? Math.round(Number(typedData.percentage))
        : 0,
      submittedAt: typedData.submitted_at,
      status: "Completed",
      userId,
    };

    return NextResponse.json(pastQuizDetails);
  } catch (err: any) {
    console.error("Error in getPastQuiz/[quizId] API route:", err);
    return NextResponse.json(
      { error: `An unexpected error occurred: ${err?.message ?? String(err)}` },
      { status: 500 }
    );
  }
}