export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
export type Color = 'w' | 'b';

export interface Piece {
  type: PieceType;
  color: Color;
  square: string;
}

export type MoveAnnotation = 'Brilliant' | 'Great' | 'Good' | 'Inaccuracy' | 'Mistake' | 'Blunder';

export interface CoachAdvice {
  explanation: string;
  consequence: string;
  whatIf: string[];
}

export interface EngineLine {
  move: string;
  eval: number; // Centipawn evaluation or mate depth
  san?: string;
}

export interface EngineEval {
  score: string; // e.g., "+1.4", "-0.8", "M3"
  value: number; // Numeric value in pawns (positive for white, negative for black)
  bestMove: string; // Coordinate move e.g., "e2e4"
  bestMoveSan?: string; // SAN move e.g., "e4"
  otherLines: EngineLine[];
}

export interface HistoryEntry {
  from: string;
  to: string;
  san: string;
  color: Color;
  notation: MoveAnnotation;
  evalScore: string;
  evalNum: number;
  fenBefore: string;
  fenAfter: string;
  advice?: CoachAdvice;
}

export interface GameSummary {
  whiteAccuracy: number;
  blackAccuracy: number;
  whiteStats: {
    brilliant: number;
    great: number;
    good: number;
    inaccuracy: number;
    mistake: number;
    blunder: number;
  };
  blackStats: {
    brilliant: number;
    great: number;
    good: number;
    inaccuracy: number;
    mistake: number;
    blunder: number;
  };
  bestMoveOfTheGame: {
    player: 'White' | 'Black';
    san: string;
    verdict: string;
  } | null;
}
