# Trelvix AI

Trelvix AI is a modern, clean AI companion for content creators, styled like Grok. It helps you generate viral ideas, high-retention scripts, and optimized hashtags in seconds.

## Features

- **Grok-like Minimal Design**: Dark mode by default with a clean, focused interface.
- **AI-Powered Generation**: Specialized modes for Ideas, Scripts, and Hashtags.
- **Streaming Chat**: Real-time AI responses with a smooth streaming effect.
- **Conversation History**: Automatically saves your chats to Supabase.
- **Pro Plan**: Support for a premium plan with activation keys.
- **Fully Responsive**: Works seamlessly on desktop and mobile.

## Tech Stack

- **Frontend**: React (Vite), Tailwind CSS, Lucide React, Framer Motion.
- **Backend**: Express.js (Node.js).
- **AI**: OpenAI API (via `openai` SDK).
- **Database/Auth**: Supabase.

## Getting Started

### Prerequisites

- Node.js (v18+)
- Supabase Account
- OpenAI API Key

### Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd trelvix-ai
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add the following:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Build for production**:
   ```bash
   npm run build
   ```

## Deployment

### Vercel / Netlify (Frontend)
The frontend can be deployed as a static site, but since this is a full-stack app with an Express backend, you should deploy it to a platform that supports Node.js (like Heroku, Railway, or Render) or use a serverless function for the API.

### Supabase Setup
Ensure you have the following tables in your Supabase database:

#### `profiles`
- `id`: uuid (primary key, references auth.users)
- `email`: text
- `plan`: text (default: 'free')
- `usage_count`: int (default: 0)
- `max_usage`: int (default: 15)
- `pro_expires_at`: timestamp

#### `conversations`
- `id`: uuid (primary key)
- `user_id`: uuid (references auth.users)
- `title`: text
- `type`: text
- `messages`: jsonb
- `created_at`: timestamp
- `updated_at`: timestamp

## Company Information

- **Company Name**: Ingenium Virtual Assistant Limited
- **Website**: [Ingeniumvirtualassistant.com](https://Ingeniumvirtualassistant.com)
- **Owner**: Ingenium Virtual Assistant Limited

## Credits

Built by **Emmanuel Nwaije** ([EmmanationDesigns.com](https://EmmanationDesigns.com))

---

© 2026 Ingenium Virtual Assistant Limited. All rights reserved.
