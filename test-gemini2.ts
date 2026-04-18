import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: "Say hello",
    });
    console.log(response.text);
  } catch (e: any) {
    console.error("ERROR:", e.message);
  }
}
test();
