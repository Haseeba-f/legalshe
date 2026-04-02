// src/utils/ai.js
import Groq from 'groq-sdk';

export const callAI = async (prompt, imageBase64 = null) => {
  const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

  if (!GROQ_API_KEY || GROQ_API_KEY === 'YOUR_GROQ_API_KEY_HERE') {
    throw new Error('Please configure VITE_GROQ_API_KEY in your .env file.');
  }

  const client = new Groq({
    apiKey: GROQ_API_KEY,
    dangerouslyAllowBrowser: true
  });

  const systemPrompt = `You are LegalShe — a warm, compassionate AI legal companion for women in India. 

STRICT RULES:
1. ALWAYS respond in the SAME language the user wrote in (Telugu/Hindi/English)
2. Structure EVERY response EXACTLY as follows:
   VALIDATE: [One empathetic sentence — warm like a trusted older sister]
   LAW: [Exact BNS 2023 section. Show BNS first, old IPC in brackets. Explain simply]
   CONFIDENCE: [Your confidence percentage like 85%]
   ACTIONS: [Numbered practical steps, maximum 4]
   DISCLAIMER: [Always remind to verify with a legal professional]
3. NEVER repeat or quote abusive content back to the user
4. NEVER sound cold or robotic — always warm and empowering
5. If situation involves morphed images, sextortion or physical threats — START response with crisis helplines BEFORE legal info: iCall 9152987821, Vandrevala 1860-2662-345
6. Use BNS 2023 sections ONLY (never old IPC alone):
   Cyberbullying = BNS 351 (formerly IPC 509)
   Morphed images = IT Act 66E / BNS 77
   Cyberstalking = IT Act 66A / BNS 78
   Workplace harassment = POSH Act / BNS 75
   Threats = BNS 351(3)
   Online abuse = IT Act 67 / BNS 79`;

  try {
    // Note: We ignore the imageBase64 parameter and use the text-only Llama 3.1 8b instant model.
    // This works perfectly because Shield.jsx uses Tesseract.js (OCR) to extract the text from the image for us
    // and correctly injects it into the prompt string natively anyway!
    
    const response = await client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 1024,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('API Call Error:', error);
    throw new Error(error.message || 'Failed to reach Groq API');
  }
};
