'use client';

import React, { useState, useRef } from 'react';

interface Interactive3DCardProps {
  imageSrc: string;
  title: string;
  subtitle: string;
  tag?: string;
  price?: string;
  onClick?: () => void;
}

export const Interactive3DCard: React.FC<Interactive3DCardProps> = ({
  imageSrc,
  title,
  subtitle,
  tag = 'Chef Recommended',
  price,
  onClick,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = ((y - centerY) / centerY) * -12; // tilt angle
    const rotY = ((x - centerX) / centerX) * 12;

    setRotateX(rotX);
    setRotateY(rotY);
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.35,
    });
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      style={{
        perspective: '1200px',
        display: 'inline-block',
        width: '100%',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-xl)',
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
          transition: 'transform 0.1s ease-out, box-shadow 0.2s ease',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Specular glare */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            pointerEvents: 'none',
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,${glarePos.opacity}) 0%, transparent 65%)`,
            transition: 'opacity 0.2s ease',
          }}
        />

        {/* Image layer */}
        <div
          style={{
            height: '280px',
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <img
            src={imageSrc}
            alt={title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scale(1.05)',
              transition: 'transform 0.4s ease',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
            }}
          />

          {/* Floating Badges */}
          {tag ? (
            <div
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                transform: 'translateZ(30px)',
              }}
            >
              {tag}
            </div>
          ) : null}

          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              backgroundColor: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(8px)',
              color: '#FDE047',
              fontSize: '11px',
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid rgba(253, 224, 71, 0.3)',
              transform: 'translateZ(30px)',
            }}
          >
            ★ 4.9 (1.2k+ Reviews)
          </div>

          {/* Info layer */}
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              right: '16px',
              transform: 'translateZ(40px)',
              color: '#FFFFFF',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '8px' }}>
              <div>
                <h4 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>{title}</h4>
                {subtitle ? (
                  <p style={{ fontSize: '13px', color: '#E2E8F0', marginTop: '4px', lineHeight: 1.3 }}>{subtitle}</p>
                ) : null}
              </div>
              {price && (
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    color: '#9A3412',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 800,
                    fontSize: '15px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
                  }}
                >
                  {price}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3D Interactive Feature Callouts */}
        <div
          style={{
            padding: '12px 14px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '8px 14px',
            backgroundColor: 'var(--bg-card)',
            borderTop: '1px solid var(--border-color)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            fontWeight: 600,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            🔥 Fresh Clay Oven
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            🌿 100% Halal Desi Ghee
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            ⚡ Cooked On Order
          </span>
        </div>
      </div>
    </div>
  );
};
