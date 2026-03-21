export default function HomePlateLoader({ message = 'Loading Dugout IQ...' }) {
  // Real home plate: flat top, vertical sides, angled to a point
  // Official shape: 17" top, 8.5" sides straight down, then two 12" edges to the point
  const points = '20,8 80,8 80,48 50,88 20,48';
  // Approximate perimeter for stroke-dasharray
  const perimeter = 252;

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
