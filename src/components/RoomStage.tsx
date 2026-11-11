'use client';

import { useEffect, useState } from 'react';
import { ROOM } from '../config/site';
import { PieceView } from './PieceView';

// The room's piece behind its opening: framed for the screen's shape, playing its entrance as the page opens.
export function RoomStage({ piece, className }: { piece: string; className?: string }) {
  const [frame, setFrame] = useState<{ shift: number; scale: number; x: number } | null>(null);
  useEffect(() => {
    const pick = () => { const a = innerWidth / innerHeight; setFrame(a >= 1.15 ? ROOM.frame.wide : a >= 0.65 ? ROOM.frame.upright : ROOM.frame.tall); };
    pick();
  }, []);
  return frame ? <PieceView name={piece} entrance frame={frame} className={className} /> : <div className={className} />;
}
