# Mindryx - AI Quiz Generator and Study Platform

<div align="center">

![Mindryx Logo](frontend/public/Mindryx_logo.png)

**A serverless quiz generation platform powered by AI**

*Study smarter with dynamically generated quizzes from any topic or PDF*

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Clerk Auth](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk)](https://clerk.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3FCF8E?logo=supabase)](https://supabase.com/)
[![Gemini](https://img.shields.io/badge/AI-Gemini%20Flash-4285F4?logo=google)](https://ai.google.dev/)
[![WebLLM](https://img.shields.io/badge/Browser%20AI-WebLLM-FF6B35)](https://github.com/mlc-ai/web-llm)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

## 🎯 What is Mindryx?

Mindryx is a learning-focused quiz and AI study platform that transforms your content into engaging multiple-choice quizzes using AI. Whether you're studying from textbooks, lecture notes, or exploring new topics, Mindryx makes learning interactive and effective.

## 🚧 Project Status

**Production Branch:**
- 🎯 **Vercel** deployment with Supabase Serverless Functions 
- 🗄️ **Supabase** PostgreSQL database
- 💳 **Stripe** sandbox experimentation
- 🔐 Server-side authentication for API route protection
- 🚀 Production-optimized performance and security

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/humza987/mindryx.git
   cd mindryx
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env.local`
   - Add your Clerk Auth keys
   - Add Supabase project URL and anon key
   - Add Gemini API key from Google AI Studio (generous free tier)

4. **Set up Supabase**
   - Create a new Supabase project
   - Deploy the edge functions in `/supabase/functions/`

5. **Run the development server**
   ```bash
   npm run dev
   ```

## ✨ Features

### Core Functionality
- **📝 PDF & Topic-Based Quiz Generation** — Enter any subject and get tailored questions
- **📄 PDF Intelligence** — Upload documents with automatic text extraction and OCR
- **📊 Progress Tracking** — Review past quizzes and monitor learning progress
- **🔐 Secure Authentication** — Powered by Clerk for seamless user management

### Experimental Features
- **🤖 In-Browser AI Chat** — Local LLM running entirely in your browser (WebLLM)

## Illustrations

![Preview](frontend/public/Preview.png)

![Quiz Generation](frontend/public/Quiz_Generation.png)

![Quiz Example](frontend/public/Quiz_Example.png)

![Chatbot Page](frontend/public/Chatbot_Page.png)

## 🏗️ Architecture

Built with modern serverless architecture using Next.js for the frontend, Supabase for database and edge functions, Clerk for authentication, Gemini Flash LLM for AI generation, and WebLLM for in-browser AI capabilities.

## 🛠️ Tech Stack

**Frontend**
- Next.js 15 with App Router
- TailwindCSS 4 for styling
- Clerk authentication
- Lucide Icons
- Tesseract.js + pdfjs-dist for OCR

**Backend**
- Supabase PostgreSQL database
- Supabase Edge Functions (Deno)
- json_repair for robust JSON parsing

**AI & ML**
- Gemini Flash 2.0 Lite LLM API for AI generation
- WebLLM for in-browser chat
- Tesseract OCR for document text extraction

## 📋 API Endpoints

```
POST   /quiz/new                # Request new quiz generation
GET    /quiz/{quizId}           # Retrieve specific quiz
POST   /submit                  # Submit quiz answers
GET    /past-quizzes            # List completed quizzes
GET    /past-quiz/{quizId}      # Get quiz with results
GET    /outstanding-quizzes     # List pending quizzes
```

## 🔀 Branch Strategy

**Production Branch (Current)**
- Production-ready deployment
- Frontend: Vercel deployment
- Backend: Supabase Serverless Edge Functions (Deno)
- Database: Supabase PostgreSQL
- Authentication: Server-side API route protection

**Testing Branch (Learning)**
- Experimentation with serverless patterns
- Infrastructure: LocalStack + Docker for AWS emulation
- Database: DynamoDB (emulated)
- Deployment: Local development only

## 🤝 Contributing

This is a learning project built for educational purposes. Contributions and suggestions are welcome!

### Areas for Improvement
- Enhanced OCR for complex PDF layouts and tables
- Lesson generation with flashcards and gamification
- Mobile experience improvements
- Analytics dashboard for learning progress
- Spaced repetition for optimal retention

### Getting Involved

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Submit a pull request with a clear description

## 🔮 Roadmap

### Production Branch Goals
- [ ] Lesson generation with flashcards and notes summarization
- [ ] WebLLM optimization for better in-browser AI performance
- [ ] Error recovery with robust failure handling
- [ ] Collaborative quizzes for sharing and remixing
- [ ] Export options (PDF and Anki deck generation)

## 📄 License

This project is licensed under the MIT License — feel free to use, modify, and distribute as you see fit.

## 🙏 Acknowledgments

Built with amazing developer tools:
- Supabase for BaaS
- Google AI Studio for accessible AI APIs
- Clerk for authentication
- Tesseract.js for OCR capabilities
- WebLLM for in-browser AI
- Next.js team for the framework

---

<div align="center">

**Made with passion as a learning project**

*Questions? Ideas? Found a bug?*  
[Open an issue](https://github.com/humza987/mindryx/issues)

</div>