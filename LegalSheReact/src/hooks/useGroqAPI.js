import { useState } from 'react';
import Groq from 'groq-sdk';

const client = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true
});

export function useGroqAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const callGroq = async (messages, systemPrompt, maxTokens = 800) => {
    if (!import.meta.env.VITE_GROQ_API_KEY) {
      throw new Error('VITE_GROQ_API_KEY missing in .env file');
    }
    setLoading(true);
    setError(null);
    try {
      const response = await client.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        max_tokens: maxTokens,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ]
      });
      setLoading(false);
      return response.choices[0].message.content;
    } catch (err) {
      const message = err.message || 'Something went wrong. Please try again.';
      setError(message);
      setLoading(false);
      throw new Error(message);
    }
  };

  return { callGroq, loading, error };
}
