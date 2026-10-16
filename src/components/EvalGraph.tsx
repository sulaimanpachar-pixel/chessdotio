import React, { useRef, useState, useEffect } from "react";
import { HistoryEntry } from "../types";

interface EvalGraphProps {
  history: HistoryEntry[];
  activeHistoryIndex: number; // -1 means start, otherwise current index in history
  onSelectMoveIndex: (index: number) => void;
}

export const EvalGraph: React.FC<EvalGraphProps> = ({
  history,
  activeHistoryIndex,
  onSelectMoveIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 120 });
  const [hoveredPoint, setHoveredPoint] = useState<{
    index: number;
    x: number;
    y: number;
    san: string;
    score: string;
    player: string;
  } | null>(null);

  // Resize handler to fit container width
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        setDimensions({
          width: Math.max(200, width),
          height: 120,
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const paddingX = 35;
  const paddingY = 15;
  const chartWidth = dimensions.width - paddingX * 2;
  const chartHeight = dimensions.height - paddingY * 2;

  // We start with a base 0.0 score representational point before any moves
  const pointsData = [
    {
      evalNum: 0,
      score: "0.0",
      san: "Start",
      color: "w" as "w" | "b",
    },
    ...history.map((h) => ({
      evalNum: h.evalNum,
      score: h.evalScore,
      san: h.san,
      color: h.color,
    })),
  ];

  const pointsCount = pointsData.length;

  // Convert an evaluation value to a Y coordinate
  const getY = (val: number) => {
    // We cap the evaluation at -6 and +6 for the graph limits
    const limit = 6;
    const capped = Math.max(-limit, Math.min(limit, val));
    // Capped value ranges from -limit to +limit.
    // Center is dimensions.height / 2 (Y increases downwards, so +limit goes to near top)
    const ratio = capped / limit; // -1 to +1
    return dimensions.height / 2 - ratio * (chartHeight / 2);
  };

  // Convert point index to X coordinate
  const getX = (index: number) => {
    if (pointsCount <= 1) {
      return dimensions.width / 2;
    }
    return paddingX + (index / (pointsCount - 1)) * chartWidth;
  };

  // Build SVG path definition
  let pathD = "";
  if (pointsCount > 0) {
    pathD = `M ${getX(0)} ${getY(pointsData[0].evalNum)}`;
    for (let i = 1; i < pointsCount; i++) {
      pathD += ` L ${getX(i)} ${getY(pointsData[i].evalNum)}`;
    }
  }

  // Create gradient zones: gold for White win (+), purple for Black win (-)
  const zeroLineY = getY(0);

  return (
    <div ref={containerRef} className="w-full bg-[#1C140F] border border-[#352317] rounded-xl p-4 shadow-xl select-none relative mb-4" id="eval-graph-panel">
      {/* Title block */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-[#CEBCA0] tracking-wider font-serif uppercase">Position Score-Sheet Graph</span>
        <div className="flex gap-4 text-[10px] font-mono">
          <span className="flex items-center gap-1.5 text-[#E6D5BC]">
            <span className="w-2.5 h-1.5 bg-[#E6D5BC] rounded-xs"></span> White Advantage
          </span>
          <span className="flex items-center gap-1.5 text-[#CEBCA0]/70">
            <span className="w-2.5 h-1.5 bg-[#2D231C] border border-[#CEBCA0]/30 rounded-xs"></span> Black Advantage
          </span>
        </div>
      </div>

      <div className="relative">
        <svg width={dimensions.width} height={dimensions.height} className="overflow-visible">
          {/* Definitions for elegant linen-wood gradients */}
          <defs>
            <linearGradient id="whiteGlowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E6D5BC" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#E6D5BC" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="blackGlowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2D231C" stopOpacity="0" />
              <stop offset="100%" stopColor="#2D231C" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          {/* Guidelines with warm-toned lines */}
          {/* Horizontal Midline representing 0.0 Balance */}
          <line
            x1={paddingX}
            y1={zeroLineY}
            x2={dimensions.width - paddingX}
            y2={zeroLineY}
            stroke="#5A4233"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.8"
          />

          {/* Subordinate horizontal lines representing +3 and -3 */}
          <line
            x1={paddingX}
            y1={getY(3)}
            x2={dimensions.width - paddingX}
            y2={getY(3)}
            stroke="#412E23"
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity="0.6"
          />
          <line
            x1={paddingX}
            y1={getY(-3)}
            x2={dimensions.width - paddingX}
            y2={getY(-3)}
            stroke="#412E23"
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity="0.6"
          />

          {/* Y-axis Labels */}
          <text x={12} y={getY(4) + 4} fill="#8A7665" className="text-[9.5px] font-mono font-bold tracking-tight">+4.0</text>
          <text x={12} y={zeroLineY + 4} fill="#5A4233" className="text-[9.5px] font-mono font-bold tracking-tight">0.0</text>
          <text x={12} y={getY(-4) + 4} fill="#8A7665" className="text-[9.5px] font-mono font-bold tracking-tight">-4.0</text>

          {/* Glow fills representing advantages zones */}
          {pointsCount > 1 && (
            <>
              {/* White area (top-half) */}
              <polygon
                points={`
                  ${getX(0)},${zeroLineY}
                  ${pointsData.map((p, idx) => `${getX(idx)},${Math.min(zeroLineY, getY(p.evalNum))}`).join(" ")}
                  ${getX(pointsCount - 1)},${zeroLineY}
                `}
                fill="url(#whiteGlowGrad)"
              />
              {/* Black area (bottom-half) */}
              <polygon
                points={`
                  ${getX(0)},${zeroLineY}
                  ${pointsData.map((p, idx) => `${getX(idx)},${Math.max(zeroLineY, getY(p.evalNum))}`).join(" ")}
                  ${getX(pointsCount - 1)},${zeroLineY}
                `}
                fill="url(#blackGlowGrad)"
              />
            </>
          )}

          {/* The Live Evaluation Line */}
          {pointsCount > 0 && (
            <path
              d={pathD}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2.5"
              className="transition-all duration-300"
            />
          )}

          {/* Linear gradient mapping of evaluation line color based on white (linen/cream) & black (dark charcoal) */}
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E6D5BC" />    {/* Cream Birch */}
            <stop offset="50%" stopColor="#9B846E" />   {/* Sand transition */}
            <stop offset="100%" stopColor="#382E28" />  {/* Espresso Walnut */}
          </linearGradient>

          {/* Current index vertical bar */}
          {activeHistoryIndex >= -1 && pointsCount > 0 && (
            <line
              x1={getX(activeHistoryIndex + 1)}
              y1={paddingY}
              x2={getX(activeHistoryIndex + 1)}
              y2={dimensions.height - paddingY}
              stroke="#CEBCA0"
              strokeWidth="1"
              strokeDasharray="2 2"
              className="animate-pulse"
            />
          )}

          {/* Clickable points */}
          {pointsData.map((p, idx) => {
            const x = getX(idx);
            const y = getY(p.evalNum);
            const isLatest = idx === activeHistoryIndex + 1;

            return (
              <g key={idx} className="cursor-pointer">
                {/* Large transparent helper circle for easier hovering / clicking */}
                <circle
                  cx={x}
                  cy={y}
                  r={8}
                  fill="transparent"
                  onMouseEnter={() => {
                    setHoveredPoint({
                      index: idx,
                      x,
                      y,
                      san: p.san,
                      score: p.score,
                      player: idx === 0 ? "Initial" : p.color === "w" ? "White" : "Black",
                    });
                  }}
                  onMouseLeave={() => setHoveredPoint(null)}
                  onClick={() => onSelectMoveIndex(idx - 1)} // idx 0 is start, which is -1 in chess history indices
                />
                <circle
                  cx={x}
                  cy={y}
                  r={isLatest ? 4 : 2}
                  fill={isLatest ? "#CEBCA0" : p.evalNum > 0 ? "#E6D5BC" : p.evalNum < 0 ? "#4A372C" : "#9B846E"}
                  stroke={isLatest ? "#FAF6EB" : "transparent"}
                  strokeWidth={isLatest ? 1.5 : 0}
                  className="transition-all duration-150 transform hover:scale-200"
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute z-50 bg-[#140F0C]/95 border border-[#3E2B1F] rounded-lg p-2.5 text-[11px] font-sans shadow-2xl text-[#E6D5BC] pointer-events-none transform -translate-x-1/2 -translate-y-full"
            style={{
              left: `${hoveredPoint.x}px`,
              top: `${hoveredPoint.y - 12}px`,
            }}
          >
            <div className="font-bold flex items-center gap-1.5 mb-1 font-serif">
              <span>{hoveredPoint.index === 0 ? "Initial Board" : `Move ${Math.ceil(hoveredPoint.index / 2)} (${hoveredPoint.player})`}</span>
              <span className={`text-[10px] font-mono rounded px-1.5 py-0.5 ${
                parseFloat(hoveredPoint.score) > 0 ? "bg-[#E6D5BC]/15 text-[#E6D5BC]" :
                parseFloat(hoveredPoint.score) < 0 ? "bg-[#CEBCA0]/15 text-[#CEBCA0]/80" : "bg-[#2A1D15] text-[#8A7665]"
              }`}>
                {hoveredPoint.score}
              </span>
            </div>
            {hoveredPoint.index > 0 && (
              <div className="text-[#CEBCA0]/80 font-mono text-[10px]">Played: <span className="text-[#E6D5BC] font-serif font-bold italic">{hoveredPoint.san}</span></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
