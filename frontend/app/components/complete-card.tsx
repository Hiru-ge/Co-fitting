import { Link } from "react-router";
import { useRef, useState, useCallback } from "react";

interface CompleteCardProps {
  /** 渡されても呼ばれない — カードはスワイプアウトせずスピンして戻る */
  onSwipe?: () => void;
}

const SWIPE_THRESHOLD = 120;
const TILT_FACTOR = 0.15;
const MAX_TILT = 10;

// 🔵 REFACTOR: 星フィールドの座標を定数配列として定義
const STARS: Array<{ top: string; left: string; size: number }> = [
  { top: "8%",  left: "12%", size: 2 },
  { top: "15%", left: "72%", size: 1 },
  { top: "22%", left: "38%", size: 3 },
  { top: "30%", left: "85%", size: 2 },
  { top: "45%", left: "18%", size: 1 },
  { top: "52%", left: "60%", size: 2 },
  { top: "60%", left: "30%", size: 3 },
  { top: "68%", left: "78%", size: 1 },
  { top: "75%", left: "48%", size: 2 },
  { top: "82%", left: "8%",  size: 1 },
  { top: "88%", left: "65%", size: 2 },
  { top: "35%", left: "52%", size: 1 },
];

/**
 * 今日の3件提案をすべてコンプリートした際に表示するカード。
 * DiscoveryCard と同じポインタハンドラを持つが、スワイプ閾値超過時は
 * その場でスピンして元に戻る（スワイプアウトしない）。
 */
export default function CompleteCard({ onSwipe: _onSwipe }: CompleteCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isSpinning, setIsSpinning] = useState(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isSpinning) return;
      dragging.current = true;
      startPos.current = { x: e.clientX, y: e.clientY };
      offsetRef.current = { x: 0, y: 0 };
      setOffset({ x: 0, y: 0 });
      cardRef.current?.setPointerCapture(e.pointerId);
    },
    [isSpinning]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const newOffset = {
      x: e.clientX - startPos.current.x,
      y: e.clientY - startPos.current.y,
    };
    offsetRef.current = newOffset;
    setOffset(newOffset);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;

    const { x, y } = offsetRef.current;
    const dist = Math.sqrt(x ** 2 + y ** 2);
    if (dist > SWIPE_THRESHOLD) {
      offsetRef.current = { x: 0, y: 0 };
      setOffset({ x: 0, y: 0 });
      setIsSpinning(true);
      // isSpinning は onAnimationEnd で解除される（CSS animation 0.9s）
    } else {
      offsetRef.current = { x: 0, y: 0 };
      setOffset({ x: 0, y: 0 });
    }
  }, []);

  // ドラッグ量を傾き角度に変換（移動はせず傾くだけ）
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const tiltY = clamp(offset.x * TILT_FACTOR, -MAX_TILT, MAX_TILT);   // 左右の傾き
  const tiltX = clamp(-offset.y * TILT_FACTOR, -MAX_TILT, MAX_TILT);  // 上下の傾き

  // spinning 中は CSS animation に transform を任せ、inline style から外す
  const cardStyle: React.CSSProperties = {
    background:
      "radial-gradient(ellipse at center, #1a1040 0%, #0a0820 40%, #000000 100%)",
    ...(isSpinning
      ? {}
      : {
          transform: `perspective(800px) rotateY(${tiltY}deg) rotateX(${tiltX}deg)`,
          transition: dragging.current ? "none" : "transform 0.3s ease-out",
        }),
  };

  return (
    <div
      ref={cardRef}
      role="region"
      aria-label="コンプリート"
      className={`absolute inset-0 rounded-3xl overflow-hidden shadow-xl select-none touch-none cursor-grab active:cursor-grabbing${isSpinning ? " isSpinning animate-card-spin" : ""}`}
      style={cardStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onAnimationEnd={() => setIsSpinning(false)}
    >
      {/* 星フィールド */}
      {STARS.map((star, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            backgroundColor: "white",
            borderRadius: "50%",
          }}
        />
      ))}

      {/* ネビュラグロー */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle, rgba(120,80,220,0.25) 0%, transparent 70%)",
        }}
      />

      {/* コンテンツ */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 text-center">
        {/* トロフィーアイコン */}
        <span
          className="material-symbols-outlined text-yellow-400"
          style={{
            fontSize: "4rem",
            filter: "drop-shadow(0 0 20px rgba(250,200,0,0.7))",
          }}
        >
          emoji_events
        </span>

        {/* メッセージ */}
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            今日の3件コンプリート！
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            今日の冒険はすべて達成しました。
            <br />
            明日また新しいスポットが待っています！
          </p>
        </div>

        {/* 履歴リンク */}
        <Link
          to="/history"
          className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 transition-colors rounded-full text-white font-bold text-sm"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="material-symbols-outlined text-base">history</span>
          訪問した場所を振り返る
        </Link>
      </div>
    </div>
  );
}
