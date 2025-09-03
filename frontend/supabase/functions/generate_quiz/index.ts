// import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// import { jwtVerify, createRemoteJWKSet } from "https://esm.sh/jose@4";
// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers":
//     "authorization, x-client-info, apikey, content-type",
//   "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
// };
// const ISSUER = env("CLERK_ISSUER");
// const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));
// function env(name) {
//   return Deno.env.get(name) ?? "";
// }
// serve(async (req) => {
//   if (req.method === "OPTIONS") {
//     return new Response("ok", {
//       headers: corsHeaders,
//     });
//   }
//   try {
//     // 1️⃣ Verify Clerk JWT
//     const authHeader = req.headers.get("Authorization") || "";
//     if (!authHeader.startsWith("Bearer "))
//       throw new Error("Missing Bearer token");
//     const token = authHeader.replace("Bearer ", "");
//     const { payload } = await jwtVerify(token, JWKS, {
//       issuer: ISSUER,
//     });
//     const clerkUserId = payload.sub;
//     // 2️⃣ Parse request body
//     const body = await req.json().catch(() => ({}));
//     const {
//       topic = "General Knowledge",
//       difficulty = "medium",
//       numQuestions = 5,
//       content,
//     } = body;
//     // 3️⃣ Build AI prompt
//     let prompt;
//     if (content) {
//       prompt = `Based on the following content, generate ${numQuestions} multiple choice questions at ${difficulty} difficulty level:

// Content:
// ${content.substring(0, 3000)}...

// Each question must have 4 options ("a", "b", "c", "d") and mark the correct option with "correct": true.
// Return only valid JSON in this structure:
// {
//   "quiz": [
//     {
//       "text": "Question text",
//       "options": [
//         {"id": "a", "text": "Option A", "correct": false},
//         {"id": "b", "text": "Option B", "correct": true},
//         {"id": "c", "text": "Option C", "correct": false},
//         {"id": "d", "text": "Option D", "correct": false}
//       ]
//     }
//   ]
// }`;
//     } else {
//       prompt = `Generate ${numQuestions} multiple choice questions on "${topic}" at ${difficulty} difficulty level.

// Each question must have 4 options ("a", "b", "c", "d") and mark the correct option with "correct": true.
// Return only valid JSON in this structure:
// {
//   "quiz": [
//     {
//       "text": "Question text",
//       "options": [
//         {"id": "a", "text": "Option A", "correct": false},
//         {"id": "b", "text": "Option B", "correct": true},
//         {"id": "c", "text": "Option C", "correct": false},
//         {"id": "d", "text": "Option D", "correct": false}
//       ]
//     }
//   ]
// }`;
//     }
//     // 4️⃣ Call Gemini API with fallback models and retry
//     const geminiApiKey = env("GEMINI_API_KEY");
//     if (!geminiApiKey) {
//       throw new Error("GEMINI_API_KEY environment variable not set");
//     }
//     // Try multiple models in order of preference
//     const models = [
//       "gemini-2.5-flash-lite",
//       "gemini-2.5-flash",
//       "gemini-1.5-flash",
//     ];
//     let aiContent = null;
//     let lastError = null;
//     for (const model of models) {
//       try {
//         console.log(`Trying model: ${model}`);
//         const aiResp = await fetch(
//           `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
//           {
//             method: "POST",
//             headers: {
//               "Content-Type": "application/json",
//             },
//             body: JSON.stringify({
//               contents: [
//                 {
//                   parts: [
//                     {
//                       text: `You are a quiz generator. Return only valid JSON.\n\n${prompt}`,
//                     },
//                   ],
//                 },
//               ],
//               generationConfig: {
//                 temperature: 0.7,
//                 topK: 40,
//                 topP: 0.95,
//                 maxOutputTokens: 2048,
//                 responseMimeType: "application/json",
//               },
//             }),
//           }
//         );
//         if (!aiResp.ok) {
//           const errorText = await aiResp.text();
//           console.log(`Model ${model} failed: ${aiResp.status} - ${errorText}`);
//           lastError = new Error(
//             `${model} failed: ${aiResp.status} - ${errorText}`
//           );
//           continue; // Try next model
//         }
//         const data = await aiResp.json();
//         console.log(`Model ${model} response:`, JSON.stringify(data, null, 2));
//         // Check if response has expected structure
//         if (
//           !data.candidates ||
//           !Array.isArray(data.candidates) ||
//           data.candidates.length === 0
//         ) {
//           console.log(`Model ${model} returned no candidates`);
//           lastError = new Error(`${model} returned no candidates`);
//           continue;
//         }
//         const candidate = data.candidates[0];
//         if (
//           !candidate.content ||
//           !candidate.content.parts ||
//           !Array.isArray(candidate.content.parts)
//         ) {
//           console.log(`Model ${model} returned invalid structure`);
//           lastError = new Error(`${model} returned invalid response structure`);
//           continue;
//         }
//         aiContent = candidate.content.parts[0]?.text?.trim();
//         if (aiContent) {
//           console.log(`Successfully got content from ${model}`);
//           break; // Success! Exit the loop
//         } else {
//           console.log(`Model ${model} returned no text content`);
//           lastError = new Error(`${model} returned no text content`);
//         }
//       } catch (err) {
//         console.log(`Model ${model} threw error:`, err);
//         lastError = err;
//         continue; // Try next model
//       }
//     }
//     if (!aiContent) {
//       throw lastError || new Error("All models failed to generate content");
//     }
//     console.log("AI content received:", aiContent.substring(0, 200) + "...");
//     // 5️⃣ Parse JSON (handle ```json blocks)
//     const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
//     const jsonText = jsonMatch ? jsonMatch[1] : aiContent;
//     let quizJson;
//     try {
//       quizJson = JSON.parse(jsonText);
//     } catch (parseErr) {
//       console.error("JSON parse error:", parseErr);
//       console.error("Attempted to parse:", jsonText);
//       throw new Error(
//         `Failed to parse AI response as JSON: ${parseErr.message}`
//       );
//     }
//     if (!quizJson.quiz || !Array.isArray(quizJson.quiz)) {
//       console.error("Invalid quiz format:", quizJson);
//       throw new Error("Invalid quiz format from AI");
//     }
//     // 6️⃣ Insert into Supabase
//     const supabase = createClient(
//       env("SUPABASE_URL"),
//       env("SUPABASE_SERVICE_ROLE_KEY")
//     );
//     const { data: inserted, error: dbErr } = await supabase
//       .from("quizzes")
//       .insert({
//         user_id: clerkUserId,
//         topic: content ? `PDF: ${topic}` : topic,
//         difficulty,
//         quiz: quizJson.quiz,
//       })
//       .select()
//       .single();
//     if (dbErr) {
//       console.error("Database error:", dbErr);
//       throw dbErr;
//     }
//     return new Response(JSON.stringify(inserted), {
//       status: 200,
//       headers: {
//         ...corsHeaders,
//         "Content-Type": "application/json",
//       },
//     });
//   } catch (err) {
//     console.error("[generate_quiz] error:", err);
//     return new Response(
//       JSON.stringify({
//         error: "Internal error",
//         detail: String(err),
//       }),
//       {
//         status: 500,
//         headers: {
//           ...corsHeaders,
//           "Content-Type": "application/json",
//         },
//       }
//     );
//   }
// });
