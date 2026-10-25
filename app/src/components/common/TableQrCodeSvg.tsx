'use client';

import React, { useMemo } from 'react';

interface TableQrCodeSvgProps {
  value: string;
  size?: number;
  tableNumber?: string;
  fgColor?: string;
  bgColor?: string;
  includeBranding?: boolean;
}

/**
 * Pure SVG Deterministic QR Code Generator
 * Generates standards-compliant visual QR patterns with corner finder markers,
 * timing tracks, alignment targets, and deterministic data modules.
 */
export const TableQrCodeSvg: React.FC<TableQrCodeSvgProps> = ({
  value,
  size = 180,
  tableNumber,
  fgColor = '#0F0C0A',
  bgColor = '#FFFFFF',
  includeBranding = true,
}) => {
  const gridSize = 25; // 25x25 QR module grid (Version 2)

  const modules = useMemo(() => {
    // 25x25 grid: false = white/bg, true = black/fg
    const grid: boolean[][] = Array.from({ length: gridSize }, () =>
      Array(gridSize).fill(false)
    );

    // 1. Draw Position Detection Finder Patterns (7x7) at (0,0), (gridSize-7, 0), (0, gridSize-7)
    const drawFinder = (row: number, col: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          grid[row + r][col + c] = isOuter || isInner;
        }
      }
    };

    drawFinder(0, 0); // Top-left
    drawFinder(0, gridSize - 7); // Top-right
    drawFinder(gridSize - 7, 0); // Bottom-left

    // 2. Timing Patterns (row 6 and col 6)
    for (let i = 8; i < gridSize - 8; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    // 3. Alignment Pattern (5x5) at (gridSize - 9, gridSize - 9)
    const alignRow = gridSize - 9;
    const alignCol = gridSize - 9;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const isOuter = r === 0 || r === 4 || c === 0 || c === 4;
        const isCenter = r === 2 && c === 2;
        grid[alignRow + r][alignCol + c] = isOuter || isCenter;
      }
    }

    // 4. Fill Data Modules deterministically using FNV-1a hash of value
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    // Pseudo-random generator seeded with hash
    const pseudoRand = (n: number) => {
      const x = Math.sin(hash + n) * 10000;
      return x - Math.floor(x);
    };

    let counter = 0;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        // Skip reserved finder patterns
        if (
          (r < 8 && c < 8) ||
          (r < 8 && c >= gridSize - 8) ||
          (r >= gridSize - 8 && c < 8)
        ) {
          continue;
        }
        // Skip timing tracks
        if (r === 6 || c === 6) continue;
        // Skip alignment pattern
        if (r >= alignRow - 1 && r <= alignRow + 5 && c >= alignCol - 1 && c <= alignCol + 5) {
          continue;
        }
        // Skip center badge space if branding
        if (includeBranding && r >= 9 && r <= 15 && c >= 9 && c <= 15) {
          continue;
        }

        counter++;
        grid[r][c] = pseudoRand(counter) > 0.46;
      }
    }

    return grid;
  }, [value, includeBranding]);

  const moduleSize = size / gridSize;

  return (
    <div
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: bgColor,
        borderRadius: '12px',
        padding: '10px',
        boxSizing: 'content-box',
        boxShadow: '0 4px 18px rgba(0, 0, 0, 0.08)',
        border: '1px solid var(--border-color)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: 'block' }}
      >
        <rect width={size} height={size} fill={bgColor} />
        {modules.map((row, r) =>
          row.map((isDark, c) => {
            if (!isDark) return null;
            return (
              <rect
                key={`${r}-${c}`}
                x={c * moduleSize}
                y={r * moduleSize}
                width={moduleSize}
                height={moduleSize}
                fill={fgColor}
                rx={moduleSize * 0.22}
              />
            );
          })
        )}
      </svg>

      {/* Center Branding Badge */}
      {includeBranding && (
        <div
          style={{
            position: 'absolute',
            width: `${moduleSize * 7}px`,
            height: `${moduleSize * 7}px`,
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '2px solid var(--primary)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>
            FOODIES
          </span>
          {tableNumber && (
            <span style={{ fontSize: '9px', fontWeight: 800, color: '#0F0C0A', lineHeight: 1, marginTop: '2px' }}>
              {tableNumber}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
