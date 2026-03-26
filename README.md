# AI Expense Tracker

A full-stack AI-first expense tracking application that allows you to upload receipts, automatically extract and categorise them using an OCR+LLM pipeline, and interact with your financial data using natural language queries.

## 🚀 Features

- **Smart Receipt Scanning**: Upload images (JPG/PNG/WEBP). Tesseract OCR extracts text, and OpenAI intelligently parses merchant, items, dates, and amounts.
- **AI Categorisation**: The LLM automatically assigns a category and a confidence score to each line item.
- **Natural Language Query Engine**: Ask questions like "How much did I spend on groceries last week?" and the backend safely translates it into SQL, runs it, and replies with a human-like response and data tables.
- **AI Insights**: Generates actionable financial advice and patterns based on your last 30 days of spending.
- **Interactive Dashboard**: Powered by React Remix, Recharts, and Tailwind CSS.

## 🏗️ Architecture

- **Backend**: FastAPI (Python), async SQLAlchemy, Pydantic, PostgreSQL (via Supabase).
- **Frontend**: Remix (React Router v7), Vite, Tailwind CSS with custom glassmorphism, Recharts.
- **AI Layer**: OpenAI GPT-4o for JSON structuring, categorisation, NL-to-SQL, and conversational insights. `pytesseract` for fast initial OCR (with an OpenAI Vision fallback if Tesseract is not installed locally).

---

## 🛠️ Quick Start

### 1. Backend Setup

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   # Windows: venv\\Scripts\\activate
   # Mac/Linux: source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment variables example:
   ```bash
   cp .env.example .env
   ```
5. Edit `.env` to include your Supabase connection string and OpenAI API key.
   *Note: Ensure the Supabase URL uses `postgresql+asyncpg://` as the protocol.*
6. Start the server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   *The database schema (tables/indexes) will be created automatically on startup.*

### 2. Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite/Remix development server:
   ```bash
   npm run dev
   ```
4. Open your browser to `http://localhost:5173`. You can create an account and start uploading receipts!

---
*Built with React Remix, FastAPI, Supabase, and OpenAI.*
