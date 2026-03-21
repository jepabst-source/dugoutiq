export default function HomePlateLoader({ message = 'Loading Dugout IQ...' }) {
  // Home plate pentagon: flat top, angled sides, point at bottom
  // Centered in a 100x100 viewBox
  const points = '20,8 80,8 92,40 50,88 8,40';
  // Approximate perimeter for stroke-dasharray
  const perimeter = 260;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <svg
            width="72"
            height="72"
            viewBox="0 0 100 96"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="home-plate-loader"
          >
            {/* Faint background plate */}
            <polygon
              points={points}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {/* Animated tracing stroke */}
            <polygon
              points={points}
              fill="none"
              stroke="var(--color-lime)"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={perimeter}
              strokeDashoffset={perimeter}
              className="home-plate-trace"
            />
          </svg>
        </div>
        <p className="text-chalk-muted text-sm">{message}</p>
      </div>
    </div>
  );
}
