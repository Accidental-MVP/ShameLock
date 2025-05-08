import { DEFAULT_GEMINI_KEY } from './config.js';

console.log("Default key loaded:", DEFAULT_GEMINI_KEY ? "Yes" : "No"); // Debug log

export async function generateShameRoast(site, time) {
  try {
    // First check if we have a custom key
    const result = await chrome.storage.local.get("geminiApiKey");
    console.log("Storage check result:", result);
    console.log("Default key available:", DEFAULT_GEMINI_KEY ? "Yes" : "No");
    
    // If no custom key or empty string, use default key
    const apiKeyToUse = (!result.geminiApiKey || result.geminiApiKey.trim().length === 0) 
      ? DEFAULT_GEMINI_KEY 
      : result.geminiApiKey.trim();

    console.log("Using API key:", (!result.geminiApiKey || result.geminiApiKey.trim().length === 0) ? "Default key" : "Custom key");
    console.log("API key length:", apiKeyToUse.length);

    if (!apiKeyToUse) {
      console.error("No API key available");
      return "No Gemini API key found. Please add your API key in the extension settings.";
    }

    const prompt = `You are a brutally sarcastic AI trained to roast people who can't focus. 
The user opened ${site} at ${time} during a focus session.
Include this info in the insult. 
Your job is to insult them in a short, clever one-liner. 
The insult should be funny, savage, and hyperbolic. 
Think like a comedian who's also their disappointed mentor. 
No kindness. No sympathy. Just roast. 
Format: a single, punchy one-liner.`;

    console.log("Making API request to Gemini...");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKeyToUse}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      }
    );

    const data = await response.json();
    console.log("Gemini API response:", data);
    
    if (!response.ok) {
      console.error("Gemini API error:", data);
      return "Failed to generate roast. Please try again later.";
    }

    // Extract the generated text from the response
    const roast = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!roast) {
      console.error("No roast generated in response:", data);
      return "Failed to generate roast. Please try again later.";
    }

    console.log("Successfully generated roast:", roast);
    return roast;
  } catch (error) {
    console.error("Error in generateShameRoast:", error);
    return "Failed to generate roast. Please try again later.";
  }
}
