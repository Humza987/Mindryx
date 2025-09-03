import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { currentUser } from "@clerk/nextjs/server";

// Initialize Supabase client using server-only environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Type definitions for better type safety
interface QuizData {
  topic: string;
  difficulty: string;
}

interface ResultData {
  quiz_id: string;
  score: number;
  total_questions: number;
  percentage: number;
  submitted_at: string;
  quizzes: QuizData | QuizData[] | null;
}

/**
 * Handles GET requests to fetch all past (completed) quizzes for the current user.
 * A past quiz is defined as a quiz that has a corresponding entry in the 'results' table.
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate the user using Clerk
    const user = await currentUser();

    if (!user || !user.id) {
      return NextResponse.json(
        { error: "Unauthorized: User not logged in" },
        { status: 401 }
      );
    }
    const userId = user.id;

    // Query the 'results' table and join with the 'quizzes' table
    // to get details for each completed quiz.
    // We select specific columns from both tables.
    // The join is implicit through the foreign key relationship.
    const { data, error } = await supabase
      .from("results")
      .select(
        `
        quiz_id,
        score,
        total_questions,
        percentage,
        submitted_at,
        quizzes (
          topic,
          difficulty
        )
      `
      )
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false }); // Order by most recent first

    if (error) {
      console.error("Supabase query error:", error.message);
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    // If there's no data, return an empty array
    if (!data) {
      return NextResponse.json({
        pastQuizzes: [],
        count: 0,
        userId,
      });
    }

    // Map the query result to the format expected by the frontend component
    const pastQuizzes = data.map((result) => {
      // Type assertion and handle potential array from Supabase join
      const typedResult = result as unknown as ResultData;
      
      // Handle the case where quizzes might be an array (Supabase foreign key relation)
      const quizData = Array.isArray(typedResult.quizzes) 
        ? typedResult.quizzes[0] 
        : typedResult.quizzes;

      return {
        quizId: typedResult.quiz_id,
        topic: quizData?.topic || "Unknown Topic",
        difficulty: quizData?.difficulty || "Unknown",
        score: typedResult.score,
        totalQuestions: typedResult.total_questions,
        // Supabase returns numeric types as strings, so we parse it to a number.
        percentage: Math.round(Number(typedResult.percentage)),
        submittedAt: typedResult.submitted_at,
        status: "Completed", // Explicitly set status as these are from the results table
      };
    });

    // Return the formatted data
    return NextResponse.json({
      pastQuizzes,
      count: pastQuizzes.length,
      userId,
    });
  } catch (err: any) {
    console.error("Error in getPastQuizzes API route:", err);
    return NextResponse.json(
      { error: `An unexpected error occurred: ${err.message}` },
      { status: 500 }
    );
  }
}