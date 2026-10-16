import { EngineEval, EngineLine } from "../types";

export class StockfishEngine {
  private worker: Worker | null = null;
  private onEvalCallback: ((evaluation: EngineEval) => void) | null = null;
  private isAnalyzing = false;
  private currentLines: EngineLine[] = [];
  private bestmoveCoord = "";
  private currentDepth = 0;

  // Uses Cloudflare cdnjs URL for stockfish.js
  private cdnUrl = "https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js";

  constructor() {
    this.initWorker();
  }

  private async initWorker() {
    try {
      // Fetch and create a blob to bypass CORS errors for web worker origin
      const response = await fetch(this.cdnUrl);
      const blob = await response.text();
      const workerBlob = new Blob([blob], { type: "application/javascript" });
      this.worker = new Worker(URL.createObjectURL(workerBlob));

      // Set up UCI protocol
      this.worker.postMessage("uci");
      this.worker.postMessage("setoption name MultiPV value 3"); // top 3 alternative moves
      this.worker.postMessage("isready");

      this.worker.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data);
      };
    } catch (error) {
      console.error("Failed to initialize Stockfish worker:", error);
    }
  }

  public analyze(fen: string, onUpdate: (evaluation: EngineEval) => void, maxDepth: number = 15) {
    if (!this.worker) {
      // Re-init if failed earlier
      this.initWorker();
      return;
    }

    this.onEvalCallback = onUpdate;
    this.isAnalyzing = true;
    this.currentLines = [];
    this.currentDepth = 0;

    // Direct stockfish to analyze position
    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`go depth ${maxDepth}`);
  }

  public stop() {
    if (this.worker && this.isAnalyzing) {
      this.worker.postMessage("stop");
      this.isAnalyzing = false;
    }
  }

  private handleMessage(message: string) {
    // Parse UCI info message lines
    if (message.startsWith("info ")) {
      this.parseInfoLine(message);
    } else if (message.startsWith("bestmove ")) {
      this.isAnalyzing = false;
      const parts = message.split(" ");
      this.bestmoveCoord = parts[1];
      this.triggerUpdate();
    }
  }

  private parseInfoLine(line: string) {
    // E.g., info depth 12 seldepth 12 multipv 1 score cp 33 nodes 12101 nps 11201 pv e2e4 e7e5 ...
    // E.g., info depth 12 multipv 2 score mate -3 ...
    const depthMatch = line.match(/\bdepth (\d+)\b/);
    if (depthMatch) {
      this.currentDepth = parseInt(depthMatch[1], 10);
    }

    const multipvMatch = line.match(/\bmultipv (\d+)\b/);
    const scoreCpMatch = line.match(/\bscore cp (-?\d+)\b/);
    const scoreMateMatch = line.match(/\bscore mate (-?\d+)\b/);
    const pvMatch = line.match(/ pv ([\s\S]+)$/);

    if (multipvMatch && pvMatch) {
      const idx = parseInt(multipvMatch[1], 10) - 1; // 0-indexed
      const fullPv = pvMatch[1].trim();
      const moves = fullPv.split(" ");
      const move = moves[0]; // first move of principal variation

      let value = 0;
      let scoreStr = "0.0";

      if (scoreCpMatch) {
        const cp = parseInt(scoreCpMatch[1], 10);
        value = cp / 100; // standard centipawn representation
        scoreStr = value > 0 ? `+${value.toFixed(1)}` : `${value.toFixed(1)}`;
      } else if (scoreMateMatch) {
        const mate = parseInt(scoreMateMatch[1], 10);
        value = mate > 0 ? 1000 + mate : -1000 + mate; // mate weighting
        scoreStr = mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
      }

      this.currentLines[idx] = {
        move,
        eval: value,
      };

      // Trigger progress updates
      if (idx === 0) {
        this.triggerUpdate();
      }
    }
  }

  private triggerUpdate() {
    if (!this.onEvalCallback) return;

    // Filter null values and clean up sorted lines
    const sortedLines = [...this.currentLines].filter(Boolean);

    if (sortedLines.length === 0) return;

    // Primary engine evaluation sits at index 0 (multipv 1)
    const primaryLine = sortedLines[0];
    const bestMove = this.bestmoveCoord || primaryLine.move;

    const evaluation: EngineEval = {
      score: primaryLine.eval > 500 ? `M${Math.round(1000 - Math.abs(primaryLine.eval))}` :
             primaryLine.eval < -500 ? `-M${Math.round(1000 - Math.abs(primaryLine.eval))}` :
             primaryLine.eval > 0 ? `+${primaryLine.eval.toFixed(1)}` : primaryLine.eval.toFixed(1),
      value: primaryLine.eval,
      bestMove,
      otherLines: sortedLines.slice(1),
    };

    this.onEvalCallback(evaluation);
  }
}
