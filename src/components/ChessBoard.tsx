import React from "react";
import { ChessPiece } from "./ChessPieces";
import { PieceType, Color, MoveAnnotation } from "../types";

interface ChessBoardProps {
  board: any[][];
  boardOrientation: Color;
  selectedSquare: string | null;
  possibleMoves: string[];
  bestMoveHighlight: { from: string; to: string } | null;
  lastMoveHighlight: { from: string; to: string } | null;
  kingInCheckSquare: string | null;
  onSquareClick: (square: string) => void;
  onMoveAttempt: (from: string, to: string) => void;
  annotations: Record<string, { type: MoveAnnotation; color: string; symbol: string }>;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  board,
  boardOrientation,
  selectedSquare,
  possibleMoves,
  bestMoveHighlight,
  lastMoveHighlight,
  kingInCheckSquare,
  onSquareClick,
  onMoveAttempt,
  annotations,
}) => {
  // Translate a board coordinate to standard Chess algebraic notation (e.g., "e4")
  const getSquareName = (row: number, col: number): string => {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];

    if (boardOrientation === "w") {
      return `${files[col]}${ranks[row]}`;
    } else {
      return `${files[7 - col]}${ranks[7 - row]}`;
    }
  };

  // Convert row and column indices based on board orientation
  const getRowColFromSquare = (square: string): { row: number; col: number } => {
    const file = square.charCodeAt(0) - 97; // 'a' is 97
    const rank = 8 - parseInt(square[1], 10);
    if (boardOrientation === "w") {
      return { row: rank, col: file };
    } else {
      return { row: 7 - rank, col: 7 - file };
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, square: string) => {
    e.dataTransfer.setData("text/plain", square);
    // Allow visual feedback
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // mandatory to allow dropping
  };

  const handleDrop = (e: React.DragEvent, destinationSquare: string) => {
    e.preventDefault();
    const sourceSquare = e.dataTransfer.getData("text/plain");
    if (sourceSquare && sourceSquare !== destinationSquare) {
      onMoveAttempt(sourceSquare, destinationSquare);
    }
  };

  // Build files and ranks lists for labels
  const filesList = boardOrientation === "w" ? ["a", "b", "c", "d", "e", "f", "g", "h"] : ["h", "g", "f", "e", "d", "c", "b", "a"];
  const ranksList = boardOrientation === "w" ? ["8", "7", "6", "5", "4", "3", "2", "1"] : ["1", "2", "3", "4", "5", "6", "7", "8"];

  return (
    <div className="relative w-full aspect-square max-w-[500px] select-none rounded-2xl bg-[#4E2B15] p-7 shadow-2xl border-4 border-[#351C0C] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)]" id="chess-board-container">
      {/* Engraved Coordinate File and Rank Labels on Mahogany Borders */}
      {/* Left Gutter Ranks */}
      <div className="absolute left-1.5 top-7 bottom-7 w-4 flex flex-col justify-around items-center text-[11px] font-bold text-[#E6D5BC]/60 font-serif">
        {ranksList.map((rank) => <span key={rank}>{rank}</span>)}
      </div>
      {/* Right Gutter Ranks */}
      <div className="absolute right-1.5 top-7 bottom-7 w-4 flex flex-col justify-around items-center text-[11px] font-bold text-[#E6D5BC]/60 font-serif">
        {ranksList.map((rank) => <span key={rank}>{rank}</span>)}
      </div>
      {/* Top Gutter Files */}
      <div className="absolute top-1 left-7 right-7 h-5 flex justify-around items-center text-[11px] font-bold text-[#E6D5BC]/60 font-serif uppercase tracking-wider">
        {filesList.map((file) => <span key={file}>{file}</span>)}
      </div>
      {/* Bottom Gutter Files */}
      <div className="absolute bottom-1 left-7 right-7 h-5 flex justify-around items-center text-[11px] font-bold text-[#E6D5BC]/60 font-serif uppercase tracking-wider">
        {filesList.map((file) => <span key={file}>{file}</span>)}
      </div>

      {/* Main Chess Board Grid */}
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full rounded border border-[#2B170B] overflow-hidden shadow-inner">
        {Array.from({ length: 8 }).map((_, rIdx) => {
          return Array.from({ length: 8 }).map((_, cIdx) => {
            // Determine actual cell depending on player perspective
            const gridRow = rIdx;
            const gridCol = cIdx;

            const boardRow = boardOrientation === "w" ? gridRow : 7 - gridRow;
            const boardCol = boardOrientation === "w" ? gridCol : 7 - gridCol;

            const cell = board[boardRow]?.[boardCol];
            const squareName = getSquareName(gridRow, gridCol);

            const isLightSquare = (gridRow + gridCol) % 2 === 0;
            const isSelected = selectedSquare === squareName;
            const isPossibleMove = possibleMoves.includes(squareName);
            const isKingInCheck = kingInCheckSquare === squareName;

            // Coach Highlights
            const isBestMoveSource = bestMoveHighlight?.from === squareName;
            const isBestMoveTarget = bestMoveHighlight?.to === squareName;

            // Last moves highlight (soft background)
            const isLastMoveSource = lastMoveHighlight?.from === squareName;
            const isLastMoveTarget = lastMoveHighlight?.to === squareName;

            // Classic Wooden Chessboard Colors
            // Light birch maple squares and dark walnut brown squares
            let squareBg = isLightSquare
              ? "bg-[#EAD5B7] text-[#9E6E47]"
              : "bg-[#9E6E47] text-[#EAD5B7]";

            if (isLastMoveSource || isLastMoveTarget) {
              squareBg = isLightSquare
                ? "bg-[#E8D5B5]" // Soft warm light wood highlight
                : "bg-[#AF9677]"; // Soft dark wood highlight
            }

            // Annotation overlay at square
            const annotation = annotations[squareName];

            return (
              <div
                key={squareName}
                id={`square-${squareName}`}
                className={`relative flex items-center justify-center transition-all duration-300 w-full h-full select-none cursor-pointer ${squareBg} ${
                  isSelected ? "shadow-[inset_0_0_12px_rgba(230,172,50,0.92)] border border-amber-600/30 z-10" : ""
                }`}
                onClick={() => onSquareClick(squareName)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, squareName)}
              >
                {/* King in Check overlay */}
                {isKingInCheck && (
                  <div className="absolute inset-0 bg-[#A53333]/45 animate-pulse border border-[#901C1C] z-0" />
                )}

                {/* Coach Recommended Line overlay */}
                {isBestMoveSource && (
                  <div className="absolute inset-0 border-2 border-dashed border-[#439F9E] bg-[#439F9E]/10 animate-pulse z-0 rounded-sm" />
                )}
                {isBestMoveTarget && (
                  <div className="absolute inset-0 border-4 border-double border-[#439F9E] bg-[#439F9E]/20 z-0 flex items-center justify-center" />
                )}

                {/* Possible Moves visual indicators */}
                {isPossibleMove && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    {cell ? (
                      // Capture helper: soft red-brown glow outline
                      <div className="w-10 h-10 rounded-full border-[3.5px] border-[#A53535]/50 animate-pulse" />
                    ) : (
                      // Simple move: small dark semi-transparent neutral tactile dot
                      <div className="w-3.5 h-3.5 rounded-full bg-[#1A0F0A]/20" />
                    )}
                  </div>
                )}

                {/* Render Chess Piece */}
                {cell && (
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, squareName)}
                    className="relative flex items-center justify-center h-[90%] w-[90%] z-25 hover:scale-105 active:scale-95 cursor-grab active:cursor-grabbing transform transition-transform duration-150"
                  >
                    <ChessPiece type={cell.type} color={cell.color} className="drop-shadow-lg" />
                  </div>
                )}

                {/* Move Annotation Badge pop-up */}
                {annotation && (
                  <div
                    className={`absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold text-[#FAF6EB] shadow-md ${annotation.color} animate-bounce z-40 transform scale-110`}
                  >
                    {annotation.symbol}
                  </div>
                )}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
};
