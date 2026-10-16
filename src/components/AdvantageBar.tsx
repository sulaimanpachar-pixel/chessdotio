import React from "react";

interface AdvantageBarProps {
  score: string; // e.g., "+1.4", "-0.8", "M3"
  value: number; // Positive for White, negative for Black
}

export const AdvantageBar: React.FC<AdvantageBarProps> = ({ score, value }) => {
  const isMate = score.includes("M");

  // Determine standard numeric offset
  let cleanValue = value;
  if (isMate) {
    cleanValue = score.startsWith("-") ? -12 : 12;
  }

  // Sigmoidal compression (Lichess style) to reduce visual sensitivity
  // score in pawns (cleanValue)
  const expVal = Math.exp(-0.28 * cleanValue);
  const compressed = 2 / (1 + expVal) - 1; // ranges smoothly from -1 to 1
  const whiteShare = 50 + (compressed * 50); // scale to 0 to 100%
  const blackShare = 100 - whiteShare;

  return (
    <div className="w-9 h-full min-h-[320px] flex flex-col items-center bg-[#14100D] rounded border border-[#2D211A] p-[2px] relative overflow-hidden select-none shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),0_4px_12px_rgba(0,0,0,0.4)]" id="advantage-evaluation-bar">
      {/* Black Zone (charcoal basalt) */}
      <div
        className="absolute top-0 left-0 right-0 bg-[#211A16] transition-all duration-700 ease-out z-0"
        style={{ height: `${blackShare}%` }}
      />

      {/* White Zone (light linen/birch) */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-[#E6D5BC] transition-all duration-700 ease-out z-0"
        style={{ height: `${whiteShare}%` }}
      />

      {/* Display Score Floating overlay inside the bar */}
      <div className="z-10 flex flex-col h-full justify-between items-center py-4 text-[9px] font-mono tracking-wider font-extrabold text-center pointer-events-none">
        {/* Black score text side */}
        <span className={`px-1 py-0.5 rounded shadow-sm border border-stone-800/10 backdrop-blur-xs transition-colors ${
          whiteShare < 50 ? "bg-white/10 text-[#E6D5BC]" : "bg-black/35 text-[#E6D5BC]"
        }`}>
          {score}
        </span>
        
        {/* Subtle division border marker */}
        <div className="w-5 h-[1px] bg-stone-500/20" />
        
        {/* Turn representation indicators */}
        <span className={`transition-colors ${
          whiteShare > 50 ? "text-[#1C1613] font-black" : "text-[#E6D5BC]/60"
        }`}>
          EVAL
        </span>
      </div>
    </div>
  );
};
