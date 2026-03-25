type ColorScheme = "primary" | "purple";

const COLORS: Record<ColorScheme, string[]> = {
  primary: [
    "bg-primary-purple/60",
    "bg-yellow-400/60",
    "bg-pink-500/60",
    "bg-primary/60",
    "bg-primary-purple/60",
    "bg-accent-orange/60",
    "bg-primary/60",
    "bg-yellow-400/70",
    "bg-primary/60",
    "bg-pink-400/60",
    "bg-accent-orange/60",
    "bg-primary-purple/60",
    "bg-primary/70",
    "bg-yellow-400/60",
    "bg-pink-500/60",
    "bg-accent-orange/60",
  ],
  purple: [
    "bg-primary-purple/60",
    "bg-pink-400/60",
    "bg-pink-500/60",
    "bg-primary-purple/60",
    "bg-yellow-400/60",
    "bg-pink-400/60",
    "bg-primary-purple/60",
    "bg-yellow-400/70",
    "bg-pink-500/60",
    "bg-primary-purple/60",
    "bg-yellow-400/60",
    "bg-pink-400/60",
    "bg-primary-purple/70",
    "bg-yellow-400/60",
    "bg-pink-500/60",
    "bg-primary-purple/60",
  ],
};

const POSITIONS = [
  {
    top: "15%",
    left: "20%",
    size: "w-2 h-2",
    rotate: "-rotate-45",
    anim: "animate-confetti-1",
  },
  {
    top: "70%",
    left: "5%",
    size: "w-2 h-2",
    rotate: "-rotate-12",
    anim: "animate-confetti-2",
  },
  {
    top: "16%",
    left: "80%",
    size: "w-2 h-2",
    rotate: "rotate-45",
    anim: "animate-confetti-3",
  },
  {
    top: "30%",
    left: "3%",
    size: "w-2 h-2",
    rotate: "rotate-12",
    anim: "animate-confetti-1",
  },
  {
    top: "70%",
    left: "95%",
    size: "w-2 h-2",
    rotate: "rotate-45",
    anim: "animate-confetti-2",
  },
  {
    top: "50%",
    left: "93%",
    size: "w-2 h-2",
    rotate: "rotate-30",
    anim: "animate-confetti-3",
  },
  {
    top: "15%",
    left: "45%",
    size: "w-2 h-2",
    rotate: "rotate-20",
    anim: "animate-confetti-2",
  },
  {
    top: "40%",
    left: "3%",
    size: "w-1.5 h-1.5",
    rotate: "-rotate-30",
    anim: "animate-confetti-1",
  },
  {
    top: "22%",
    left: "95%",
    size: "w-2 h-2",
    rotate: "rotate-15",
    anim: "animate-confetti-3",
  },
  {
    top: "60%",
    left: "3%",
    size: "w-1.5 h-1.5",
    rotate: "rotate-60",
    anim: "animate-confetti-2",
  },
  {
    top: "7%",
    left: "40%",
    size: "w-2 h-2",
    rotate: "-rotate-20",
    anim: "animate-confetti-1",
  },
  {
    top: "78%",
    left: "35%",
    size: "w-2 h-2",
    rotate: "rotate-45",
    anim: "animate-confetti-3",
  },
  {
    top: "72%",
    left: "60%",
    size: "w-1.5 h-1.5",
    rotate: "-rotate-15",
    anim: "animate-confetti-2",
  },
  {
    top: "75%",
    left: "78%",
    size: "w-2 h-2",
    rotate: "rotate-30",
    anim: "animate-confetti-1",
  },
  {
    top: "30%",
    left: "98%",
    size: "w-1.5 h-1.5",
    rotate: "-rotate-60",
    anim: "animate-confetti-3",
  },
  {
    top: "40%",
    left: "98%",
    size: "w-2 h-2",
    rotate: "rotate-12",
    anim: "animate-confetti-2",
  },
];

interface ConfettiDecorationProps {
  colorScheme?: ColorScheme;
}

export default function ConfettiDecoration({
  colorScheme = "primary",
}: ConfettiDecorationProps) {
  const colors = COLORS[colorScheme];
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {POSITIONS.map((pos, i) => (
        <div
          key={i}
          className={`absolute rounded-sm ${pos.size} ${colors[i]} ${pos.rotate} ${pos.anim}`}
          style={{ top: pos.top, left: pos.left }}
        />
      ))}
    </div>
  );
}
