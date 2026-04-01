// src/hooks/useClaudeAPI.js
// Powered by Local Ollama Backend — no cloud APIs, fully private
import { useState } from 'react';

export function useClaudeAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const callClaude = async (messages, systemPrompt, maxTokens = null) => {
    setLoading(true);
    setError(null);

    try {
      // Extract user message text from the Claude/Gemini-style messages array
      const userPrompt = messages.map(m => {
        if (typeof m.content === 'string') return m.content;
        if (Array.isArray(m.content)) return m.content.map(c => c.text || '').join(' ');
        return '';
      }).join('\n');

      // Call our local Node.js Express server
      const response = await fetch('http://localhost:5000/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: userPrompt,
          systemPrompt: systemPrompt,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned error (${response.status})`);
      }

      const data = await response.json();
      
      setLoading(false);
      return data.response;

    } catch (err) {
      const message = err.message || 'An unexpected error occurred. Please make sure Ollama and the local backend are running.';
      
      // Provide helpful errors if server is unreachable
      if (message.includes('Failed to fetch')) {
        setError('Cannot connect to local AI server. Please start the backend setup on port 5000.');
      } else {
        setError(message);
      }
      
      setLoading(false);
      throw new Error(message);
    }
  };

  return { callClaude, loading, error };
}
