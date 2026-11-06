# Contributing

Thanks for your interest in contributing!

## Local development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```

3. **Start Ollama** (in another terminal):
   ```bash
   ollama serve
   ```

4. **Pull the model** (if not already cached):
   ```bash
   ollama pull qwen3:4b-instruct
   ```

5. **Run the dev server:**
   ```bash
   npm run dev
   ```

6. **Open** http://localhost:3000

## Code style

- Use strict TypeScript (`strict: true` in `tsconfig.json`).
- Avoid `any` types; use explicit generics.
- No `console.log` in production code; use proper error handling.
- Keep comments minimal — only explain the *why*, not the *what*.

## Testing changes

Before submitting a PR:

```bash
npm run build   # TypeScript compilation
npm run dev     # Manual testing in browser
```

Verify:
- `/api/health` endpoint is reachable (test with `curl http://localhost:3000/api/health`)
- `/api/chat` streams plain text correctly
- Chat UI sends/streams/stops/persists correctly
- Widget embeds and works across origins

## Submitting a PR

1. Fork the repo and create a feature branch.
2. Make your changes with clear commit messages.
3. Run `npm run build` and ensure it passes.
4. Open a PR with a description of what changed and why.

## Questions?

Open an issue or reach out. Thanks!
