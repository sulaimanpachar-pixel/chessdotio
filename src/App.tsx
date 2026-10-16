import React, { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { ChessBoard } from "./components/ChessBoard";
import { AdvantageBar } from "./components/AdvantageBar";
import { EvalGraph } from "./components/EvalGraph";
import { StockfishEngine } from "./utils/engine";
import { HistoryEntry, CoachAdvice, EngineEval, MoveAnnotation } from "./types";
import {
  Play,
  RotateCcw,
  BookOpen,
  Share2,
  ChevronDown,
  ChevronUp,
  Cpu,
  CheckCircle,
  HelpCircle,
  Clock,
  Sparkles,
  ArrowRight,
  RotateCw,
  Trophy,
  Activity
} from "lucide-react";

// Initialize Chess Engine once
const engine = new StockfishEngine();

// Local chess advisor to backfill instantaneous response
const generateLocalCoachAdvice = (move: string, verdict: MoveAnnotation, color: "w" | "b"): CoachAdvice => {
  const isW = color === "w";
  const turnName = isW ? "White" : "Black";
  const oppName = isW ? "Black" : "White";
  
  let explanation = "";
  let consequence = "";
  let whatIf: string[] = [];

  if (verdict === "Brilliant") {
    explanation = `${turnName} plays ${move}, a brilliant tactical sacrifice! This creates dynamic lines and seizes the operational initiative immediately.`;
    consequence = `${oppName} must calculate safety thresholds precisely to avoid quick tactical structural collapse.`;
    whatIf = [
      "Keep local control of open vertical files.",
      "Evaluate piece sacrifice validity before capturing back."
    ];
  } else if (verdict === "Great") {
    explanation = `${turnName} makes an excellent strategic strike with ${move}, claiming key geometric coordinates inside the center lines.`;
    consequence = `${oppName} now faces defensive compaction, and needs to coordinate minor pieces.`;
    whatIf = [
      "Prevent pawn breaks on the opposing wing.",
      "Reposition minor structural defenses toward active center files."
    ];
  } else if (verdict === "Inaccuracy") {
    explanation = `${turnName} plays ${move}, which is slightly off-position. It surrenders small positional margins, but keeps tactical parity.`;
    consequence = `${oppName} can try to utilize the minor delay to establish pawn files.`;
    whatIf = [
      "Prioritise castling and king-side safety files.",
      "Link pieces cleanly to avoid floating undefended targets."
    ];
  } else if (verdict === "Mistake") {
    explanation = `${turnName} compromises development with ${move}. This leaves loose squares that can be converted into local targets.`;
    consequence = `${oppName} is gifted options to initiate tactical pressure against coordination lines.`;
    whatIf = [
      "Review tactical alignment profiles on active ranks.",
      "Regroup minor pieces to block forward spatial incursions."
    ];
  } else if (verdict === "Blunder") {
    explanation = `${turnName} blunders with ${move}! This drops critical defense coverage, leaving active targets exposed and compromising structural integrity.`;
    consequence = `${oppName} has a clear open window to seize direct material advantages or lock down a mating net.`;
    whatIf = [
      "Examine direct checks and double attack combinations.",
      "Shor up immediate vulnerabilities near the king's shelter path."
    ];
  } else {
    explanation = `${turnName} plays a solid, textbook positional move with ${move}, maintaining stable development.`;
    consequence = `Both structures are well integrated. The positional balance remains equal.`;
    whatIf = [
      "Continue regular piece development toward center lines.",
      "Prepare secure castling squares before planning attacks."
    ];
  }

  return { explanation, consequence, whatIf };
};

export default function App() {
  // Game states
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'gameOver'>('intro');
  const [boardOrientation, setBoardOrientation] = useState<'w' | 'b'>('w');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [engineDepth, setEngineDepth] = useState<number>(15);

  // Chess state
  const [chessInstance, setChessInstance] = useState<Chess>(() => new Chess());
  const [fen, setFen] = useState<string>("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [boardState, setBoardState] = useState<any[][]>(() => new Chess().board());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMovesList, setPossibleMovesList] = useState<string[]>([]);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState<number>(-1); // -1 is starting board
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Engine evaluation states
  const [currentEval, setCurrentEval] = useState<EngineEval>({
    score: "0.0",
    value: 0,
    bestMove: "",
    otherLines: []
  });
  
  // Previous position's evaluation to compute delta
  const previousEvalRef = useRef<{ score: string; value: number }>({ score: "0.0", value: 0 });

  // Coach overlay states
  const [coachingAdvice, setCoachingAdvice] = useState<CoachAdvice | null>(null);
  const [coachLoading, setCoachLoading] = useState<boolean>(false);
  const [collapsibleWhatIfOpen, setCollapsibleWhatIfOpen] = useState<boolean>(false);
  
  // Highlighting states
  const [lastMoveHighlight, setLastMoveHighlight] = useState<{ from: string; to: string } | null>(null);
  const [bestMoveHighlight, setBestMoveHighlight] = useState<{ from: string; to: string } | null>(null);
  const [kingInCheckSquare, setKingInCheckSquare] = useState<string | null>(null);

  // Stats / Game Over summarizes
  const [whiteAccuracy, setWhiteAccuracy] = useState<number>(100);
  const [blackAccuracy, setBlackAccuracy] = useState<number>(100);
  const [aiGameOverSummary, setAiGameOverSummary] = useState<string>("");
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);

  // Active / Live view check FEN
  const liveFen = activeHistoryIndex === history.length - 1 
    ? fen 
    : (activeHistoryIndex === -1 ? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" : history[activeHistoryIndex].fenAfter);

  // Synchronize board drawing based on activeHistoryIndex (Replay / Review Mode)
  useEffect(() => {
    const activeChess = new Chess();
    if (activeHistoryIndex === -1) {
      activeChess.load("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      setLastMoveHighlight(null);
      setBestMoveHighlight(null);
      setKingInCheckSquare(null);
      setCoachingAdvice(null);
    } else {
      const entry = history[activeHistoryIndex];
      activeChess.load(entry.fenAfter);
      setLastMoveHighlight({ from: entry.from, to: entry.to });
      
      // If there's saved AI coach advice for this historic move, restore it!
      if (entry.advice) {
        setCoachingAdvice(entry.advice);
      } else {
        setCoachingAdvice({
          explanation: `Move ${activeHistoryIndex + 1}: ${entry.color === 'w' ? 'White' : 'Black'} played ${entry.san}. Calculated as a ${entry.notation} with position evaluation at ${entry.evalScore}.`,
          consequence: `This move resulted in an evaluation score of ${entry.evalScore}.`,
          whatIf: ["Alternative lines will refresh on live moves."]
        });
      }

      // Highlight best move recommendation if available
      if (entry.advice && entry.evalScore) {
        // Find recommend best move from historical data if stored, or clear
        setBestMoveHighlight(null);
      }

      // Sync King-in-check
      if (activeChess.inCheck()) {
        const turn = activeChess.turn();
        // find king location
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const piece = activeChess.board()[r][c];
            if (piece && piece.type === 'k' && piece.color === turn) {
              setKingInCheckSquare(piece.square);
              break;
            }
          }
        }
      } else {
        setKingInCheckSquare(null);
      }
    }
    setBoardState(activeChess.board());
  }, [activeHistoryIndex, history]);

  // Handle engine analysis outcomes
  const handleEngineUpdate = async (evaluation: EngineEval) => {
    setCurrentEval(evaluation);
    
    // Once Stockfish returns the definitive bestmove, trigger AI explanation endpoint!
    if (evaluation.bestMove && evaluation.bestMove.length >= 4) {
      const from = evaluation.bestMove.substring(0, 2);
      const to = evaluation.bestMove.substring(2, 4);
      
      // Show proposed best move briefly
      setBestMoveHighlight({ from, to });

      // Only invoke the Gemini Coach API for the LATEST play of the live game
      // and when we are not in historical review mode
      const isLiveMoveCalculation = activeHistoryIndex === history.length - 1;
      
      if (isLiveMoveCalculation && history.length > 0) {
        const latestEntry = history[history.length - 1];
        
        // Skip calling Coach API if already populated for this move
        if (latestEntry.advice) return;

        setCoachLoading(true);
        try {
          const res = await fetch("/api/coach", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              move: latestEntry.san,
              verdict: latestEntry.notation,
              score: evaluation.score,
              bestMove: evaluation.bestMoveSan || evaluation.bestMove,
              otherLines: evaluation.otherLines,
              turn: latestEntry.color,
              history: history.map(h => h.san),
              fenBefore: latestEntry.fenBefore,
              fenAfter: latestEntry.fenAfter
            })
          });

          if (res.ok) {
            const adviceData: CoachAdvice = await res.json();
            setCoachingAdvice(adviceData);
            
            // Backfill history entry with detailed AI advice
            setHistory(prev => {
              const clone = [...prev];
              if (clone[clone.length - 1]) {
                clone[clone.length - 1].advice = adviceData;
              }
              return clone;
            });
          } else {
            throw new Error("Failed to load coaching advice");
          }
        } catch (err) {
          console.error(err);
          // Fallback coaching
          setCoachingAdvice({
            explanation: `You successfully updated the board with ${latestEntry.san}. Keep trying to control the center, build structural defenses, and protect your back rank!`,
            consequence: `Currently analyzing lines. The engine continues to favor developing minor pieces.`,
            whatIf: [
              `Consider starting lines with ${evaluation.bestMove || 'active development'}.`,
              "Support structural lines with active pawn grids."
            ]
          });
        } finally {
          setCoachLoading(false);
        }
      }
    }
  };

  // Convert engine coordinate move (e2e4) to standard algebraic SAN (e4) for coach presentation
  const getSanFromCoords = (chess: Chess, moveStr: string): string => {
    try {
      const temp = new Chess(chess.fen());
      const res = temp.move({
        from: moveStr.substring(0, 2),
        to: moveStr.substring(2, 4),
        promotion: moveStr.length === 5 ? moveStr[4] : undefined
      });
      return res.san;
    } catch {
      return moveStr;
    }
  };

  // Trigger game start / reset
  const startGame = () => {
    const starter = new Chess();
    setChessInstance(starter);
    setFen(starter.fen());
    setBoardState(starter.board());
    setHistory([]);
    setSelectedSquare(null);
    setPossibleMovesList([]);
    setLastMoveHighlight(null);
    setBestMoveHighlight(null);
    setKingInCheckSquare(null);
    setCoachingAdvice(null);
    setActiveHistoryIndex(-1);
    setCurrentEval({ score: "0.0", value: 0, bestMove: "", otherLines: [] });
    previousEvalRef.current = { score: "0.0", value: 0 };
    setGameState('playing');

    // Run initial stockfish analysis on starting position
    engine.analyze(starter.fen(), (evaluation) => {
      // Record initial SAN values for recommended best moves
      evaluation.bestMoveSan = getSanFromCoords(starter, evaluation.bestMove);
      setCurrentEval(evaluation);
    }, engineDepth);
  };

  // Reset the game back
  const handleResetGame = () => {
    startGame();
  };

  // Handle clicks on squares
  const handleSquareClick = (square: string) => {
    // If we're hovering a historical replay point, block moves
    if (activeHistoryIndex !== history.length - 1) return;

    const piece = chessInstance.get(square as any);

    if (selectedSquare === square) {
      // De-select
      setSelectedSquare(null);
      setPossibleMovesList([]);
      return;
    }

    if (selectedSquare) {
      // Check if target is a valid move
      const moves = chessInstance.moves({ square: selectedSquare as any, verbose: true });
      const isValidMove = moves.some((m) => m.to === square);

      if (isValidMove) {
        // Execute move
        executeMove(selectedSquare, square);
        setSelectedSquare(null);
        setPossibleMovesList([]);
        return;
      }
    }

    // Select piece if it belongs to active turn player
    if (piece && piece.color === chessInstance.turn()) {
      setSelectedSquare(square);
      const moves = chessInstance.moves({ square: square as any, verbose: true });
      setPossibleMovesList(moves.map((m) => m.to));
    } else {
      setSelectedSquare(null);
      setPossibleMovesList([]);
    }
  };

  // Handle Drag-and-drop move triggers
  const handleMoveAttempt = (from: string, to: string) => {
    if (activeHistoryIndex !== history.length - 1) return;
    executeMove(from, to);
  };

  // Execute Move state transitions
  const executeMove = (from: string, to: string) => {
    try {
      const fenBefore = chessInstance.fen();
      const tempChessForSan = new Chess(fenBefore);
      const movingPiece = chessInstance.get(from as any);
      const activeTurn = chessInstance.turn();

      // Trigger actual move
      const moveResult = chessInstance.move({
        from: from as any,
        to: to as any,
        promotion: "q" // Auto-promote to queen for simplified beginner experience
      });

      if (!moveResult) return;

      const fenAfter = chessInstance.fen();
      setFen(fenAfter);
      setBoardState(chessInstance.board());

      // Evaluate the position delta to determine move quality annotation
      // Compare the previous position's evaluation with the newly incoming one
      const prevEval = previousEvalRef.current.value;
      const currentRawScore = currentEval.value;

      // Calculate evaluation delta of the move played
      // From active player perspective:
      // Positive score means White advantage, negative means Black advantage.
      // If White played: we want the score to stay high. If it dropped, White made a mistake.
      // If Black played: we want the score to stay low. If it rose, Black made a mistake.
      const delta = activeTurn === "w" ? (prevEval - currentRawScore) : (currentRawScore - prevEval);
      const cleanDelta = Math.max(0, delta);

      // Check if the played move matches Stockfish's top recommended line
      const matchedBestMove = currentEval.bestMove && (
        (currentEval.bestMove.substring(0, 2) === from && currentEval.bestMove.substring(2, 4) === to) ||
        currentEval.bestMoveSan === moveResult.san
      );

      let annotation: MoveAnnotation = "Good";
      
      if (matchedBestMove) {
        // High quality Top engine line
        // Brilliant is defined as top line with material captures / sacrifices
        const isCapture = moveResult.captured !== undefined;
        annotation = (isCapture && Math.random() > 0.4) ? "Brilliant" : "Great";
      } else {
        // Delta Bracket mappings
        if (cleanDelta >= 1.5) {
          annotation = "Blunder";
        } else if (cleanDelta >= 0.8) {
          annotation = "Mistake";
        } else if (cleanDelta >= 0.3) {
          annotation = "Inaccuracy";
        } else {
          annotation = "Good";
        }
      }

      // Generate instantaneous local advice to display immediately
      const localAdvice = generateLocalCoachAdvice(moveResult.san, annotation, activeTurn);
      setCoachingAdvice(localAdvice);

      // Add to game history list
      const newEntry: HistoryEntry = {
        from,
        to,
        san: moveResult.san,
        color: activeTurn,
        notation: annotation,
        evalScore: currentEval.score,
        evalNum: currentRawScore,
        fenBefore,
        fenAfter,
        advice: localAdvice
      };

      const updatedHistory = [...history, newEntry];
      setHistory(updatedHistory);
      
      // Auto advance vertical bar in history list
      setActiveHistoryIndex(updatedHistory.length - 1);

      // Save this evaluation to comparison buffer for the NEXT play
      previousEvalRef.current = { score: currentEval.score, value: currentRawScore };

      // Swap perspectives if auto-rotate is toggled
      if (autoRotate) {
        setBoardOrientation(activeTurn === "w" ? "b" : "w");
      }

      // Sync King checks
      if (chessInstance.inCheck()) {
        const nextTurn = chessInstance.turn();
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const piece = chessInstance.board()[r][c];
            if (piece && piece.type === 'k' && piece.color === nextTurn) {
              setKingInCheckSquare(piece.square);
              break;
            }
          }
        }
      } else {
        setKingInCheckSquare(null);
      }

      // Check for Game-Over triggers (Checkmate, Stalemate, Draw)
      if (chessInstance.isGameOver()) {
        handleGameOver(updatedHistory);
      } else {
        // Direct Stockfish to analyze the resulting position
        setCoachLoading(true);
        engine.analyze(fenAfter, (newEvalResponse) => {
          // Resolve standard chess notations for best recommended engine lines
          newEvalResponse.bestMoveSan = getSanFromCoords(chessInstance, newEvalResponse.bestMove);
          // Auto update dashboard state
          handleEngineUpdate(newEvalResponse);
        }, engineDepth);
      }

    } catch (err) {
      console.error("Move Execution Error:", err);
    }
  };

  // Game over state triggers
  const handleGameOver = async (finalHistory: HistoryEntry[]) => {
    setGameState('gameOver');
    setSummaryLoading(true);

    const checkmate = chessInstance.isCheckmate();
    const draw = chessInstance.isDraw();
    const stalemate = chessInstance.isStalemate();

    let resultMsg = "Game finished in a draw!";
    if (checkmate) {
      const winner = chessInstance.turn() === "w" ? "Black" : "White";
      resultMsg = `Checkmate! ${winner} Wins 🏆`;
    } else if (stalemate) {
      resultMsg = "Draw by Stalemate!";
    }

    setAiGameOverSummary(`Analyzing game stats...`);

    // Fetch AI Summarizer commentary via the backend
    try {
      const moveStats = finalHistory.map(h => `${h.color === 'w' ? 'W' : 'B'}: ${h.san} (${h.notation})`).join(", ");
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          move: "Game Summary Request",
          verdict: resultMsg,
          score: currentEval.score,
          bestMove: "N/A",
          otherLines: [],
          turn: "w",
          history: finalHistory.map(h => h.san),
          fenBefore: "N/A",
          fenAfter: chessInstance.fen()
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAiGameOverSummary(data.explanation || "No commentary generated.");
      } else {
        throw new Error("Summary API failed");
      }
    } catch {
      setAiGameOverSummary(`What an intense game of chess! Both players displayed solid structural play before the game finalized under a ${resultMsg}. Press Review Game to replay moves and examine tactical spikes.`);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Re-calculate accuracies after each play
  useEffect(() => {
    if (history.length === 0) return;

    // Accuracy weights definition:
    // Brilliant = 100, Great = 95, Good = 85, Inaccuracy = 60, Mistake = 40, Blunder = 10
    const scoreMap = {
      Brilliant: 100,
      Great: 95,
      Good: 85,
      Inaccuracy: 60,
      Mistake: 40,
      Blunder: 10
    };

    const whitePlays = history.filter(h => h.color === 'w');
    const blackPlays = history.filter(h => h.color === 'b');

    if (whitePlays.length > 0) {
      const sum = whitePlays.reduce((acc, h) => acc + scoreMap[h.notation], 0);
      setWhiteAccuracy(Math.round(sum / whitePlays.length));
    }
    if (blackPlays.length > 0) {
      const sum = blackPlays.reduce((acc, h) => acc + scoreMap[h.notation], 0);
      setBlackAccuracy(Math.round(sum / blackPlays.length));
    }
  }, [history]);

  // Handle click jumps on historical moves sidebar or Eval graph coordinates
  const handleSelectHistoryIndex = (idx: number) => {
    setActiveHistoryIndex(idx);
  };

  // Safe mappings for move annotation badge color overlays
  const getAnnotationBadgeConfig = (note: MoveAnnotation) => {
    switch (note) {
      case "Brilliant":
        return { symbol: "!!", color: "bg-[#439F9E]/25 text-[#73D9D8] border border-[#439F9E]/45 font-extrabold shadow-sm shadow-[#439F9E]/30" };
      case "Great":
        return { symbol: "!", color: "bg-[#6E8A52]/25 text-[#A6C48A] border border-[#6E8A52]/40 font-bold" };
      case "Inaccuracy":
        return { symbol: "?!", color: "bg-[#D1A550]/20 text-[#E4C58B] border border-[#D1A550]/35 font-bold" };
      case "Mistake":
        return { symbol: "?", color: "bg-[#B86B52]/20 text-[#ECC3B8] border border-[#B86B52]/35 font-bold" };
      case "Blunder":
        return { symbol: "??", color: "bg-[#A53333]/30 text-[#F5B5B5] border border-[#A53333]/45 font-bold animate-pulse shadow-sm shadow-[#A53333]/20" };
      default:
        return { symbol: "", color: "hidden" };
    }
  };

  // Build active board overlay badges
  const getActiveBoardAnnotations = () => {
    const annotations: Record<string, { type: MoveAnnotation; color: string; symbol: string }> = {};
    if (activeHistoryIndex >= 0 && history[activeHistoryIndex]) {
      const entry = history[activeHistoryIndex];
      const config = getAnnotationBadgeConfig(entry.notation);
      if (config.symbol) {
        annotations[entry.to] = {
          type: entry.notation,
          color: config.color,
          symbol: config.symbol,
        };
      }
    }
    return annotations;
  };

  return (
    <div className="min-h-screen bg-[#140F0C] text-[#E6D5BC] flex flex-col font-sans transition-colors duration-300 selection:bg-amber-600/30">
      
      {/* HEADER SECTION */}
      <header className="h-14 border-b border-[#312015] bg-[#1E140E] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-50 backdrop-blur shadow-xl">
        <div className="flex items-center gap-2">
          <span className="text-[#FAF6EB] text-xl font-serif leading-none" id="header-logo-icon">♟</span>
          <h1 className="text-base sm:text-lg font-bold font-serif text-[#FAF6EB] tracking-tight whitespace-nowrap">
            Chess Coach
          </h1>
        </div>

        {gameState === 'playing' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setBoardOrientation(prev => prev === 'w' ? 'b' : 'w')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#251A13] hover:bg-[#32231A] text-[10px] font-bold uppercase tracking-wider border border-[#523C2F]/50 text-[#CEBCA0] transition-all cursor-pointer shadow"
              title="Flip Board Perspective"
            >
              <RotateCw className="w-3 h-3 text-[#EAD5B7]" />
              <span className="hidden sm:inline">Flip</span>
            </button>
            <button
              onClick={handleResetGame}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#251A13] border border-[#A53333]/40 text-[#E5A3A3] hover:bg-[#A53333]/10 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow"
              title="Reset Game"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        )}
      </header>

      {/* INTRO COVER ROUTER */}
      {gameState === 'intro' ? (
        <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12 flex flex-col justify-center animate-fade-in">
          <div className="bg-[#1C140F] border border-[#352317] rounded-xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
              <BookOpen className="w-64 h-64 text-[#FAF6EB]" />
            </div>

            {/* Title HUD Banner */}
            <div className="flex items-center gap-2 text-[#CEBCA0] font-bold text-xs uppercase tracking-widest font-mono mb-4">
              <Sparkles className="w-4 h-4" />
              <span>Pass & Play Over-The-Board</span>
            </div>

            <h2 className="text-2xl md:text-3xl font-serif font-extrabold tracking-tight mb-2 text-[#FAF6EB] leading-tight">
              Welcome to the <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FAF6EB] to-[#CEBCA0]">Classic Chess Club Overlay</span>
            </h2>
            <p className="text-xs text-[#8A7665] leading-relaxed mb-6 md:mb-8 font-sans">
              Play Chess locally against an opponent, and receive instant, state-by-state evaluation from the Stockfish Engine. This position is beautifully translated by Google Gemini into clear, encouraging, deep strategic wisdom designed to level up your chess mastery.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Feature 1 */}
              <div className="bg-[#140F0C] rounded-lg border border-[#32231A] p-4 text-[#E6D5BC]">
                <h3 className="text-xs font-bold text-[#CEBCA0] uppercase tracking-widest mb-2 flex items-semibold gap-1.5 font-serif">
                  <Activity className="w-3.5 h-3.5 text-[#EAD5B7]" /> Stockfish 10 Engine Analysis
                </h3>
                <p className="text-[11px] text-[#8A7665] leading-relaxed font-sans">
                  Every played FEN is processed down to a depth of 15. The delta calculation detects blunders, inaccuracies, or brilliant tactical plans.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-[#140F0C] rounded-lg border border-[#32231A] p-4 text-[#E6D5BC]">
                <h3 className="text-xs font-bold text-[#CEBCA0] uppercase tracking-widest mb-2 flex items-semibold gap-1.5 font-serif">
                  <Sparkles className="w-3.5 h-3.5 text-[#EAD5B7]" /> Active Conversational Advice
                </h3>
                <p className="text-[11px] text-[#8A7665] leading-relaxed font-sans">
                  No dry computer chess algebra. Learn exactly why chess rules dictate certain defensive postures or pawn breaks in encouraging, beginner-friendly terms.
                </p>
              </div>
            </div>

            {/* CONFIGURATIONS BOARD PANEL */}
            <div className="bg-[#140F0C] rounded-lg border border-[#32231A] p-5 mb-8 space-y-4">
              <h4 className="text-[10px] font-bold text-[#8A7665] uppercase tracking-widest mb-1 font-mono">Customize Chess Room Configurations</h4>
              
              <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                {/* Auto Rotate Toggle */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="auto-rotate-check"
                    checked={autoRotate}
                    onChange={(e) => setAutoRotate(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-[#1E140E] border-[#32231A] focus:ring-amber-500 focus:ring-2 cursor-pointer"
                  />
                  <label htmlFor="auto-rotate-check" className="text-xs text-[#CEBCA0] font-semibold cursor-pointer select-none">
                    Auto-Rotate Board on play (True pass-and-play)
                  </label>
                </div>

                {/* Stockfish depth dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#8A7665]">Stockfish Depth:</span>
                  <select
                    value={engineDepth}
                    onChange={(e) => setEngineDepth(parseInt(e.target.value, 10))}
                    className="bg-[#1E140E] border border-[#32231A] rounded px-2.5 py-1 text-xs text-[#CEBCA0] font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value={10}>Quick (Depth 10)</option>
                    <option value={12}>Moderate (Depth 12)</option>
                    <option value={15}>Master (Depth 15)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Start CTA Button */}
            <button
              onClick={startGame}
              className="w-full bg-[#825638] hover:bg-[#9E6E4B] border border-[#351C0C] text-[#FAF6EB] py-4 px-6 rounded-lg font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <span>Initialize Game Room Overlay</span>
              <ArrowRight className="w-4 h-4 stroke-[3px]" />
            </button>
          </div>
        </main>
      ) : gameState === 'playing' ? (
        
        /* PLAYING MAIN HUD SCREEN */
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:px-6 grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
          
          {/* LATEST ADVANTAGE VIEW MODULE (COACH PANEL + BOARD) Column */}
          <div className="lg:col-span-3 flex flex-col space-y-6">
            {/* 1. Sleek HUD Coaching Panel */}
            <div className="bg-[#1C140F] border border-[#352317] rounded-xl p-5 shadow-2xl relative overflow-hidden" id="coach-overlay-panel">
              {coachLoading && (
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#1C140F]/80 border border-[#CEBCA0]/10 rounded-full px-2.5 py-0.5 z-20 shadow-sm backdrop-blur-xs">
                  <span className="animate-ping h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                  <span className="text-[9px] font-mono font-bold text-[#E6D5BC]/60 uppercase tracking-widest">Engraving Insights...</span>
                </div>
              )}

              {coachingAdvice ? (
                // FULL RICH HUD DESCRIPTION
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 items-baseline">
                    <span className="text-xs font-bold text-[#8A7665] font-mono uppercase tracking-widest">Coach verdict:</span>
                    <h3 className={`text-base font-serif font-extrabold uppercase tracking-wide flex items-center gap-1.5 ${
                      history[activeHistoryIndex]?.notation === 'Brilliant' ? 'text-[#73D9D8]' :
                      history[activeHistoryIndex]?.notation === 'Great' ? 'text-[#A6C48A]' :
                      history[activeHistoryIndex]?.notation === 'Inaccuracy' ? 'text-[#E4C58B]' :
                      history[activeHistoryIndex]?.notation === 'Mistake' ? 'text-[#ECC3B8]' :
                      history[activeHistoryIndex]?.notation === 'Blunder' ? 'text-[#F5B5B5] animate-pulse' :
                      'text-[#FAF6EB]'
                    }`}>
                      {history[activeHistoryIndex]?.notation === "Good" 
                        ? "That was a Good Move" 
                        : `That was a${history[activeHistoryIndex]?.notation === "Inaccuracy" ? "n" : ""} ${history[activeHistoryIndex]?.notation}`
                      }
                      {history[activeHistoryIndex]?.notation && (
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold capitalize tracking-widest ${
                          getAnnotationBadgeConfig(history[activeHistoryIndex].notation).color
                        }`}>
                          {history[activeHistoryIndex].notation} {getAnnotationBadgeConfig(history[activeHistoryIndex].notation).symbol}
                        </span>
                      )}
                    </h3>
                  </div>

                  <p className="text-sm font-bold font-serif text-[#FAF6EB] leading-tight flex items-center gap-1.5">
                    <span>Move {Math.ceil((activeHistoryIndex + 1) / 2)}:</span>
                    <span className="text-[#CEBCA0] italic">{history[activeHistoryIndex]?.san}</span> 
                    <span className="text-xs font-mono font-medium text-[#8A7665]">({history[activeHistoryIndex]?.evalScore})</span>
                  </p>

                  <p className="text-[#CEBCA0] text-sm max-w-xl leading-relaxed italic font-serif">
                    &ldquo;{coachingAdvice.explanation}&rdquo;
                  </p>

                  <div className="text-xs text-[#8A7665] leading-relaxed font-sans">
                    <span className="font-bold text-[#CEBCA0] uppercase tracking-wider font-mono">Expected line: </span>
                    {coachingAdvice.consequence}
                  </div>

                  {/* COLLAPSIBLE WHAT IF SECTION */}
                  {coachingAdvice.whatIf && coachingAdvice.whatIf.length > 0 && (
                    <div className="pt-2 border-t border-[#352317]">
                      <button
                        onClick={() => setCollapsibleWhatIfOpen(!collapsibleWhatIfOpen)}
                        className="flex items-center gap-1 text-[10px] font-bold text-[#CEBCA0] hover:text-[#E6D5BC] tracking-wider uppercase transition-colors cursor-pointer"
                      >
                        {collapsibleWhatIfOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        <span>What if? Alternative structural paths</span>
                      </button>

                      {collapsibleWhatIfOpen && (
                        <ul className="mt-2 space-y-1.5 pl-4 list-disc text-[10px] text-[#8A7665] font-sans leading-relaxed animate-slide-down">
                          {coachingAdvice.whatIf.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                // INITIAL COACH OVERVIEW PROMPT BEFORE FIRST MOVE
                <div className="flex gap-4 items-center">
                  <div className="bg-[#4E3220]/40 p-2 rounded-xl text-[#CEBCA0] border border-[#3F2B1F]">
                    <Sparkles className="w-8 h-8 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold font-serif text-[#FAF6EB] uppercase tracking-wider mb-0.5">Initialize Game Board</h3>
                    <p className="text-xs text-[#8A7665] font-sans leading-relaxed">
                      Make any move on the board to launch pass-and-play evaluation. Coordinate your pieces carefully to claim key central diagonals.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Historical replay notification banner */}
            {activeHistoryIndex < history.length - 1 && (
              <div className="bg-[#1C140F] border border-[#CEBCA0]/20 text-[#CEBCA0] px-4 py-2.5 rounded-xl text-xs flex items-center justify-between font-sans shadow-2xl animate-bounce">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#CEBCA0]" />
                  <span>Reviewing Game History (Step {activeHistoryIndex + 1}/{history.length}). Interactive play is paused.</span>
                </span>
                <button
                  onClick={() => setActiveHistoryIndex(history.length - 1)}
                  className="bg-[#E6D5BC] hover:bg-[#FAF6EB] text-[#1C140F] font-black px-3 py-1 rounded text-[10px] uppercase transition-colors tracking-widest cursor-pointer shadow-md"
                >
                  Resume Play
                </button>
              </div>
            )}

            {/* 2. Board Grid & Evaluation Bar Split container */}
            <div className="flex gap-4 md:gap-6 justify-center items-stretch flex-1">
              {/* Advantage display bar */}
              <AdvantageBar score={currentEval.score} value={currentEval.value} />
              
              {/* Actual interactive Chessboard */}
              <div className="flex-1 flex justify-center">
                <ChessBoard
                  board={boardState}
                  boardOrientation={boardOrientation}
                  selectedSquare={selectedSquare}
                  possibleMoves={possibleMovesList}
                  bestMoveHighlight={bestMoveHighlight}
                  lastMoveHighlight={lastMoveHighlight}
                  kingInCheckSquare={kingInCheckSquare}
                  onSquareClick={handleSquareClick}
                  onMoveAttempt={handleMoveAttempt}
                  annotations={getActiveBoardAnnotations()}
                />
              </div>
            </div>

            {/* 3. Splendid interactive Live Position Eval Graph */}
            <EvalGraph
              history={history}
              activeHistoryIndex={activeHistoryIndex}
              onSelectMoveIndex={handleSelectHistoryIndex}
            />

          </div>

          {/* SIDEBAR WRAPPER: MOVE LIST + REAL-TIME STATS SIDEBAR COLUMN */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Realtime Accuracy HUD widget */}
            <div className="bg-[#1C140F] border border-[#352317] rounded-xl p-4 shadow-2xl">
              <h3 className="text-xs font-bold text-[#CEBCA0] font-serif uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-[#CEBCA0]" /> Match Accuracy
              </h3>
              
              <div className="space-y-3">
                {/* White Accuracy */}
                <div className="flex items-center gap-3">
                  <div className="w-10 text-[9px] font-bold text-[#FAF6EB] font-serif uppercase">White</div>
                  <div className="flex-1 h-2 bg-[#140F0C] border border-[#32231A]/30 rounded-full overflow-hidden">
                    <div
                      className="bg-[#E6D5BC] h-full rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${whiteAccuracy}%` }}
                    />
                  </div>
                  <div className="w-8 text-right text-xs font-bold text-[#FAF6EB] font-mono">{whiteAccuracy}%</div>
                </div>

                {/* Black Accuracy */}
                <div className="flex items-center gap-3">
                  <div className="w-10 text-[9px] font-bold text-[#CEBCA0] font-serif uppercase">Black</div>
                  <div className="flex-1 h-2 bg-[#140F0C] border border-[#32231A]/30 rounded-full overflow-hidden">
                    <div
                      className="bg-[#4E3220] h-full rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${blackAccuracy}%` }}
                    />
                  </div>
                  <div className="w-8 text-right text-xs font-bold text-[#CEBCA0] font-mono">{blackAccuracy}%</div>
                </div>
              </div>
            </div>

            {/* Standard Algebraic notation game move history sidebar */}
            <div className="bg-[#1C140F] border border-[#352317] rounded-xl flex-1 flex flex-col max-h-[460px]">
              <div className="p-3 border-b border-[#352317] bg-[#1C140F] flex justify-between items-center rounded-t-xl">
                <span className="text-xs font-medium font-serif uppercase tracking-widest text-[#8A7665]">Move Logs</span>
                <span className="text-[9px] px-2 py-0.5 rounded bg-[#4E2B15]/20 text-[#CEBCA0] border border-[#523C2F]/40 font-mono uppercase tracking-wider">Review Mode</span>
              </div>
              
              {history.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#8A7665]/60 border border-dashed border-[#32231A] rounded-xl m-4">
                  <Play className="w-8 h-8 stroke-[1.5px] opacity-40 mb-2 rotate-90 text-[#CEBCA0]" />
                  <p className="text-[10px] font-mono uppercase">Moves played will record here</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-1 p-3 max-h-[380px]" id="history-scroller">
                  {/* Pair moves in standard Move numbers (1. e4 e5) */}
                  {Array.from({ length: Math.ceil(history.length / 2) }).map((_, stepIdx) => {
                    const whiteEntryIdx = stepIdx * 2;
                    const blackEntryIdx = stepIdx * 2 + 1;

                    const whiteEntry = history[whiteEntryIdx];
                    const blackEntry = history[blackEntryIdx];

                    return (
                      <div key={stepIdx} className="grid grid-cols-[30px_1fr_1fr] gap-2 py-1 items-center border-b border-[#32231A]/30 font-mono text-sm leading-none">
                        <span className="text-[#8A7665] font-bold text-xs">{stepIdx + 1}.</span>

                        {/* White item playable jump */}
                        <div
                          onClick={() => handleSelectHistoryIndex(whiteEntryIdx)}
                          className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-all ${
                            activeHistoryIndex === whiteEntryIdx
                              ? "bg-[#3E2B1F] text-[#FAF6EB] font-bold border border-[#5A4233] shadow-inner"
                              : "hover:bg-[#251A13]/50 text-[#CEBCA0]"
                          }`}
                        >
                          <span className="font-serif">{whiteEntry.san}</span>
                          <span className={`text-[9px] font-sans px-1 rounded scale-90 ${
                            whiteEntry.notation === 'Brilliant' ? 'bg-[#439F9E]/20 text-[#73D9D8]' :
                            whiteEntry.notation === 'Great' ? 'bg-[#6E8A52]/20 text-[#A6C48A]' :
                            whiteEntry.notation === 'Inaccuracy' ? 'bg-[#D1A550]/20 text-[#E4C58B]' :
                            whiteEntry.notation === 'Mistake' ? 'bg-[#B86B52]/20 text-[#ECC3B8]' :
                            whiteEntry.notation === 'Blunder' ? 'bg-[#A53333]/35 text-[#F5B5B5]' :
                            'bg-[#140F0C] text-[#8A7665]'
                          }`}>
                            {getAnnotationBadgeConfig(whiteEntry.notation).symbol || 'Good'}
                          </span>
                        </div>

                        {/* Black item playable jump */}
                        {blackEntry ? (
                          <div
                            onClick={() => handleSelectHistoryIndex(blackEntryIdx)}
                            className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-all ${
                              activeHistoryIndex === blackEntryIdx
                                ? "bg-[#3E2B1F] text-[#FAF6EB] font-bold border border-[#5A4233] shadow-inner"
                                : "hover:bg-[#251A13]/50 text-[#CEBCA0]"
                            }`}
                          >
                            <span className="font-serif">{blackEntry.san}</span>
                            <span className={`text-[9px] font-sans px-1 rounded scale-90 ${
                              blackEntry.notation === 'Brilliant' ? 'bg-[#439F9E]/20 text-[#73D9D8]' :
                              blackEntry.notation === 'Great' ? 'bg-[#6E8A52]/20 text-[#A6C48A]' :
                              blackEntry.notation === 'Inaccuracy' ? 'bg-[#D1A550]/20 text-[#E4C58B]' :
                              blackEntry.notation === 'Mistake' ? 'bg-[#B86B52]/20 text-[#ECC3B8]' :
                              blackEntry.notation === 'Blunder' ? 'bg-[#A53333]/35 text-[#F5B5B5]' :
                              'bg-[#140F0C] text-[#8A7665]'
                            }`}>
                              {getAnnotationBadgeConfig(blackEntry.notation).symbol || 'Good'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#8A7665] italic text-[11px] pl-2 font-sans">...thinking</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </main>
      ) : (
        /* GAME OVER SUMMARY PAGE SCREEN */
        <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 flex flex-col justify-center animate-fade-in">
          <div className="bg-[#1C140F] border border-[#352317] rounded-xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
            
            <div className="flex items-center gap-2 text-[#A53333] font-bold text-xs uppercase tracking-widest font-mono mb-4">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>Overlay Calculation Complete</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-serif font-extrabold tracking-tight mb-4 text-[#FAF6EB] flex items-center gap-3">
              <span>Game Concluded!</span>
            </h2>

            {/* Accuracy Display dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* White stats */}
              <div className="bg-[#140F0C] rounded-xl p-5 border border-[#32231A] text-center relative overflow-hidden shadow-inner">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Trophy className="w-20 h-20 text-[#E6D5BC]" />
                </div>
                <span className="text-[9px] font-bold text-[#CEBCA0] uppercase tracking-widest font-mono">White Accuracy (WHT)</span>
                <p className="text-4xl font-extrabold text-[#FAF6EB] font-serif tracking-tight my-1">{whiteAccuracy}%</p>
                <div className="text-[11px] text-[#8A7665] mt-2 flex justify-center gap-3 font-sans">
                  <span>Blunders: <b className="text-[#F5B5B5]">{history.filter(h => h.color === 'w' && h.notation === 'Blunder').length}</b></span>
                  <span>Mistakes: <b className="text-[#ECC3B8]">{history.filter(h => h.color === 'w' && h.notation === 'Mistake').length}</b></span>
                  <span>Greats: <b className="text-[#A6C48A]">{history.filter(h => h.color === 'w' && h.notation === 'Great').length}</b></span>
                </div>
              </div>

              {/* Black stats */}
              <div className="bg-[#140F0C] rounded-xl p-5 border border-[#32231A] text-center relative overflow-hidden shadow-inner font-serif">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Trophy className="w-20 h-20 text-[#4E3220]" />
                </div>
                <span className="text-[9px] font-bold text-[#CEBCA0] uppercase tracking-widest font-mono">Black Accuracy (BLK)</span>
                <p className="text-4xl font-extrabold text-[#FAF6EB] tracking-tight my-1">{blackAccuracy}%</p>
                <div className="text-[11px] text-[#8A7665] mt-2 flex justify-center gap-3 font-sans">
                  <span>Blunders: <b className="text-[#F5B5B5]">{history.filter(h => h.color === 'b' && h.notation === 'Blunder').length}</b></span>
                  <span>Mistakes: <b className="text-[#ECC3B8]">{history.filter(h => h.color === 'b' && h.notation === 'Mistake').length}</b></span>
                  <span>Greats: <b className="text-[#A6C48A]">{history.filter(h => h.color === 'b' && h.notation === 'Great').length}</b></span>
                </div>
              </div>
            </div>

            {/* AI GAME SUMMARY COMMENTARY */}
            <div className="bg-[#140F0C] rounded-xl p-6 border border-[#32231A] mb-8">
              <h3 className="text-xs font-bold text-[#CEBCA0] uppercase tracking-widest font-serif mb-3 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#CEBCA0]" /> Chess Club Post-Mortem Advice
              </h3>

              {summaryLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-3.5 bg-[#1F1611]/80 rounded w-full" />
                  <div className="h-3.5 bg-[#1F1611]/80 rounded w-11/12" />
                  <div className="h-3.5 bg-[#1F1611]/80 rounded w-10/12" />
                </div>
              ) : (
                <p className="text-xs text-[#FAF6EB]/90 leading-relaxed font-serif italic">
                  &ldquo;{aiGameOverSummary}&rdquo;
                </p>
              )}
            </div>

            {/* Flow CTA Controls */}
            <div className="flex flex-col md:flex-row gap-4">
              <button
                onClick={() => {
                  setGameState('playing');
                  // Jump back to starting move to let them review
                  setActiveHistoryIndex(history.length - 1);
                }}
                className="flex-1 py-3 bg-[#251A13] hover:bg-[#32231A] rounded-lg text-xs font-bold uppercase tracking-widest border border-[#523C2F]/50 text-[#CEBCA0] flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <BookOpen className="w-4 h-4 text-[#CEBCA0]" />
                <span>Review board moves</span>
              </button>

              <button
                onClick={handleResetGame}
                className="flex-1 py-3 bg-[#825638] hover:bg-[#9E6E4B] text-[#FAF6EB] border border-[#351C0C] rounded-lg text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play New Game</span>
              </button>
            </div>

          </div>
        </main>
      )}

      {/* FOOTER SECTION */}
      <footer className="border-t border-[#312015] bg-[#1E140E] px-6 py-3 text-center text-[9px] text-[#8A7665] font-mono flex flex-col md:flex-row items-center justify-between">
        <p>CHESS CLUB &copy; 2026. AUTHENTIC PHYSICAL AMBIANCE.</p>
        <p className="text-[#CEBCA0] flex items-center gap-1 mt-1 md:mt-0">
          <Sparkles className="w-3.5 h-3.5 text-[#CEBCA0]" />
          <span>Sourced by Stockfish WASM + Google Gemini</span>
        </p>
      </footer>

    </div>
  );
}
