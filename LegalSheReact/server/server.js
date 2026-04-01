const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000;
const OLLAMA_URL = 'http://localhost:11434/api/generate';

// Default system prompt — used if none provided by frontend
const DEFAULT_SYSTEM_PROMPT = `You are a legal assistant specialized in Indian law (BNS 2023 and IT Act).
Analyze user input and:
- Identify if harassment, abuse, or crime is present
- Mention relevant legal sections clearly
- Provide safe, supportive, non-judgmental guidance
- NEVER output explicit abusive content
- Keep answers structured and concise`;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'LegalShe AI (Ollama)' });
});

// Main AI endpoint
app.post('/api/analyze', async (req, res) => {
  const { prompt, systemPrompt } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  // Combine system prompt + user prompt
  const fullPrompt = `${systemPrompt || DEFAULT_SYSTEM_PROMPT}\n\n---\nUser Input:\n${prompt}`;

  try {
    // Check if Ollama is reachable first
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout

    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral',
        prompt: fullPrompt,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`Ollama error (${response.status}):`, errText);

      // Check if model not found
      if (response.status === 404 || errText.includes('not found')) {
        return res.status(503).json({
          error: 'Model not found. Run: ollama pull mistral',
        });
      }

      return res.status(502).json({
        error: `Ollama returned error (${response.status}). Make sure Ollama is running.`,
      });
    }

    const data = await response.json();
    res.json({ response: data.response });

  } catch (err) {
    console.error('Ollama connection error:', err.message);

    if (err.name === 'AbortError') {
      return res.status(504).json({
        error: 'AI took too long to respond. Try a shorter prompt or use mistral model.',
      });
    }

    // Ollama not running
    if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'AI service is offline. Please start Ollama (run: ollama serve).',
      });
    }

    res.status(500).json({
      error: 'Failed to connect to AI service. Is Ollama running on port 11434?',
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🔒 LegalShe AI Server running at http://localhost:${PORT}`);
  console.log(`📡 Ollama endpoint: ${OLLAMA_URL}`);
  console.log(`\n💡 Make sure Ollama is running: ollama serve`);
  console.log(`💡 Make sure mistral is pulled: ollama pull mistral\n`);
});
