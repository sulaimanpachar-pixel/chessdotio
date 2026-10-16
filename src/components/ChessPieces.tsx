import React from "react";
import { PieceType, Color } from "../types";

interface ChessPieceProps {
  type: PieceType;
  color: Color;
  className?: string;
  size?: number;
}

export const ChessPiece: React.FC<ChessPieceProps> = ({ type, color, className = "", size = 45 }) => {
  const pieceCode = `${color}${type.toUpperCase()}`;
  const src = `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/${pieceCode}.svg`;
  const pieceName = `${color === "w" ? "White" : "Black"} ${
    type === "p" ? "Pawn" :
    type === "r" ? "Rook" :
    type === "n" ? "Knight" :
    type === "b" ? "Bishop" :
    type === "q" ? "Queen" :
    type === "k" ? "King" : "Piece"
  }`;

  return (
    <img
      src={src}
      alt={pieceName}
      style={{ width: size, height: size }}
      className={`${className} drop-shadow-[0_3px_5px_rgba(0,0,0,0.45)] select-none pointer-events-none transition-all duration-200`}
      referrerPolicy="no-referrer"
    />
  );
};
