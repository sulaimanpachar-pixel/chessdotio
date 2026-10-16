import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini AI
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey ? new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  }) : null;

  // Endpoint for chess coach analysis
  app.post("/api/coach", async (req, res) => {
    try {
      const {
        move,
        verdict,
        score,
        bestMove,
        otherLines,
        turn,
        history,
        fenBefore,
        fenAfter
      } = req.body;

      if (!ai) {
        // Safe fallback advice if apiKey is not registered yet
        const displayTurn = turn === 'w' ? 'White' : 'Black';
        return res.json({
          explanation: `You made the move ${move}. This was evaluated as a ${verdict} with an evaluation of ${score}. Focus on central control, piece harmony, and keeping your king safe!`,
          consequence: `After this move, the game remains dynamic. The engine strongly favors ${bestMove || 'developing active pieces'} in this style of position.`,
          whatIf: [
            bestMove ? `Consider playing ${bestMove} to improve piece activity.` : "Ensure your minor pieces are developed to control key center grids.",
            otherLines && otherLines[0] ? `Or consider ${otherLines[0].move} to establish defensive grids.` : "Maintain defense on undefended targets."
          ]
        });
      }

      const prompt = `
You are an encouraging, slightly strict, beginner-friendly Chess Coach explaining a move in a live pass-and-play game.
The active player is: "${turn === 'w' ? 'White' : 'Black'}".
They played the move: "${move}".
Your analysis of this move shows the verdict is: "${verdict}".
The position evaluation score after this move is: "${score}" (positive scores mean White is leading, negative scores mean Black is leading; M means mate).
The engine's recommended best move in this position was: "${bestMove}".
Alternative strong engine lines in this position were: ${JSON.stringify(otherLines)}.
Full game history of moves so far: ${JSON.stringify(history)}.
FEN of the board BEFORE the move: ${fenBefore}
FEN of the board AFTER the move: ${fenAfter}

Explain to the beginner player WHY this move was a ${verdict} and what the consequences are in terms of king safety, piece safety, central control, development, etc.
Always explain WHY in human terms, avoiding dry engine lingo like raw coordinates unless physically explained (e.g., say 'your knight on f3' or 'pushing the d-pawn to d4').
Provide your response in a structured format containing:
1. A conversational plain-English explanation (approx 2-3 sentences), explaining specifically why this move fits the verdict.
2. A consequence preview (1-2 sentences) about what replies are expected or how the position changes.
3. A list of 2-3 alternative lines ("What if?") explained naturally in plain English.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: {
                type: Type.STRING,
                description: "Conversational explanation of why physical chess principles make this move a good or bad choice."
              },
              consequence: {
                type: Type.STRING,
                description: "Consequence preview after this move. What the opponent might play or how the board's dynamic changes."
              },
              whatIf: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "2 to 3 alternative moves explained naturally in plain English (e.g., 'Pushing the pawn to d4 would open diagonals...')."
              }
            },
            required: ["explanation", "consequence", "whatIf"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response string from Gemini");
      }

      const data = JSON.parse(responseText.trim());
      res.json(data);
    } catch (error: any) {
      console.error("Coach API Error:", error);
      res.status(500).json({
        error: error.message || "Failed to generate coach advice",
        explanation: `You successfully updated the board with ${req.body.move || 'your move'}. Keep trying to control the center, build structural defenses, and protect your back rank!`,
        consequence: `Currently analyzing moves. The recommended engine defense remains ${req.body.bestMove || 'developing of minor units'}.`,
        whatIf: [
          req.body.bestMove ? `Consider starting the line with ${req.body.bestMove} for smoother files.` : "Keep minor units active in center files.",
          "Check for undefended pawns before advancing your major pieces."
        ]
      });
    }
  });

  // Serve static assets or use Vite in dev
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
