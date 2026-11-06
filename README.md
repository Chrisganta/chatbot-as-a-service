# Chatbot as a Service

An open-source, self-hostable chatbot service built with Next.js (App Router) + TypeScript. Works with any OpenAI-compatible LLM endpoint (Ollama, Groq, OpenRouter, Together, etc.).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FChris-ganta%2Fchatbot-as-a-service)

## Features

- **Streaming chat API** — `/api/chat` streams responses token-by-token
- **Web UI** — responsive chat interface with Markdown rendering
- **Embeddable widget** — `widget.js` for easy embedding on any website
- **Configurable LLM** — swap Ollama for Groq, OpenRouter, OpenAI, etc. via environment variables
- **Rate limiting** — per-IP throttling (with Upstash Redis option for production)
- **CORS support** — embeddable across any origin
- **Health check** — `/api/health` endpoint to verify LLM connectivity
- **Docker & Docker Compose** — containerized app + Ollama for zero-config deployment

## Quick Start (local with Ollama)

### 1. Download and start Ollama

```bash
# Download Ollama from https://ollama.ai (or use your package manager)
ollama serve
# In another terminal, pull the model:
ollama pull qwen3:4b-instruct
```

### 2. Set up the chatbot service

```bash
git clone https://github.com/Chris-ganta/chatbot-as-a-service.git
cd chatbot-as-a-service
npm install
cp .env.example .env.local
npm run dev
```

Visit http://localhost:3000.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `LLM_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible endpoint (no trailing slash) |
| `LLM_MODEL` | `qwen3:4b-instruct` | Model name/tag |
| `LLM_API_KEY` | _(empty)_ | Optional bearer token for the LLM endpoint |
| `SYSTEM_PROMPT` | "You are a friendly, helpful assistant." | System prompt prepended to every conversation |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins (e.g., `https://example.com,https://example.org` or `*`) |
| `SERVICE_API_KEYS` | _(empty)_ | Optional comma-separated API keys; if set, callers must send `Authorization: Bearer <key>` |
| `RATE_LIMIT_PER_MINUTE` | `20` | Max requests per IP per minute |

## API Usage

### `POST /api/chat` — Stream a response

```bash
curl -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "What is Rust?" }
    ]
  }'
```

Response streams plain text (no SSE wrapper):

```
Rust is a systems programming language that prioritizes safety and performance...
```

### JavaScript with streaming

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'hello' }],
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let result = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  result += decoder.decode(value, { stream: true });
  console.log('Chunk:', decoder.decode(value));
}
```

### `GET /api/health` — Check LLM connectivity

```bash
curl http://localhost:3000/api/health
# { "model": "qwen3:4b-instruct", "reachable": true }
```

## Embedding the Widget

Add this script tag to any website:

```html
<script 
  src="https://your-deployment.vercel.app/widget.js"
  data-title="Help"
></script>
```

### Widget options (data- attributes)

| Attribute | Default | Description |
|---|---|---|
| `data-title` | "Chat" | Widget title |
| `data-position` | "bottom-right" | Position: `bottom-right`, `bottom-left` |
| `data-color` | "#2563eb" | Bubble button color (hex) |
| `data-width` | "360px" | Iframe width |
| `data-height` | "520px" | Iframe height |

Example:

```html
<script 
  src="https://chatbot.example.com/widget.js"
  data-title="Support Chat"
  data-position="bottom-left"
  data-color="#10b981"
  data-width="400px"
  data-height="600px"
></script>
```

**Note:** The widget iframe is same-origin relative to your deployment, so it uses the same `/api/chat` endpoint without CORS. The `ALLOWED_ORIGINS` variable matters only for direct API calls made from third-party JavaScript on other sites.

## Deploying to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FChris-ganta%2Fchatbot-as-a-service)

Or manually:

```bash
npm i -g vercel
vercel
```

**Important:** Vercel is a serverless platform and cannot host Ollama. You must set `LLM_BASE_URL` to a **publicly reachable** OpenAI-compatible endpoint:

### Options

1. **Self-hosted Ollama/vLLM on a cloud VPS:**
   - Oracle Cloud's free Ampere tier (4 vCPU, 24 GB RAM)
   - DigitalOcean Droplets ($5–$40/mo)
   - Linode, Vultr, Hetzner
   
2. **Hosted LLM providers (simplest):**
   - [Groq](https://groq.com) — very fast, free tier available
   - [OpenRouter](https://openrouter.ai) — multi-model, pay-per-use
   - [Together.ai](https://www.together.ai) — inference API, free tier
   - [OpenAI](https://openai.com) — `gpt-4-turbo`, requires API key

3. **Hugging Face Spaces or Modal:**
   - Deploy a vLLM server as a Hugging Face Space or Modal function

Set environment variables in Vercel:

- `LLM_BASE_URL=https://your-ollama-server.example.com/v1`
- `LLM_MODEL=qwen3:4b-instruct` (or your chosen model)
- `LLM_API_KEY=your-api-key` (if required by the provider)
- `ALLOWED_ORIGINS=https://your-domain.com` (restrict CORS if desired)

For rate limiting on Vercel, swap `lib/rateLimit.ts` to use [Upstash Redis](https://upstash.com) (free tier available).

## Docker

### Build and run locally

```bash
docker compose up --build
# Wait for Ollama to start, then in another terminal:
docker compose exec ollama ollama pull qwen3:4b-instruct
```

Visit http://localhost:3001.

### Docker Hub (optional)

Build and push your own image:

```bash
docker build -t your-username/chatbot-as-a-service .
docker push your-username/chatbot-as-a-service
```

Then update `docker-compose.yml`:

```yaml
services:
  app:
    image: your-username/chatbot-as-a-service:latest
```

## Architecture

- **Frontend:** React 19 + TypeScript, no build step for CSS (plain CSS modules)
- **Backend:** Next.js App Router + Node.js runtime
- **LLM:** Any OpenAI-compatible endpoint (Ollama, Groq, OpenRouter, etc.)
- **Streaming:** Server-side SSE parsing → client-side plain-text streaming via `ReadableStream`
- **Persistence:** localStorage for conversation history (client-side only)
- **Rate limiting:** In-memory per-IP (swap for Upstash Redis on Vercel)

## Customization

### System prompt

Change the default system prompt via the `SYSTEM_PROMPT` env var or in `lib/config.ts`:

```
SYSTEM_PROMPT="You are an expert tutor helping students learn math."
```

### Max conversation history

Edit `lib/validateMessages.ts` to change `MAX_HISTORY` (default: 20 messages).

### Message length limit

Edit `lib/validateMessages.ts` to change `MAX_MESSAGE_LENGTH` (default: 4000 characters).

### Widget styling

Edit `public/widget.js` to customize the floating bubble appearance (colors, position, size).

### Chat UI styling

Edit `components/ChatWindow.tsx` and `components/MessageBubble.tsx` for UI changes.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local development setup and contribution guidelines.

## License

[MIT](LICENSE) — use this project freely, commercially or otherwise.

## Support

- **Issues:** Open a GitHub issue for bugs or feature requests.
- **Discussions:** GitHub Discussions for questions and ideas.
- **Security:** For security issues, please email security@example.com instead of using the issue tracker.

---

Built with ❤️ for the open-source community.
