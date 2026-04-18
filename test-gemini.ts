import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log("Using API key:", process.env.GEMINI_API_KEY ? "Set" : "Not Set");
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Say hello",
    });
    console.log(response.text);
  } catch (e: any) {
    console.error("ERROR:", e.message);
  }
}
test();
