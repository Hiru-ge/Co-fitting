interface CardIndicatorProps {
  total: number;
  currentIndex: number;
}

export default function CardIndicator({
  total,
  currentIndex,
}: CardIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`size-2 rounded-full transition-colors ${
            i === currentIndex ? "bg-primary" : "bg-gray-300"
          }`}
        />
      ))}
    </div>
  );
}
