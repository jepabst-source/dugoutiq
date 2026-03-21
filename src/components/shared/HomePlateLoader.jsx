export default function HomePlateLoader({ message = 'Loading Dugout IQ...' }) {
  // Home plate: square creased at side/bottom midpoints
  // Top full width, sides straight halfway, then angle to center bottom
  const points = '15,10 85,10 85,45 50,80 15,45';
  // Approximate perimeter for stroke-dasharray
  const perimeter = 250;

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
