export default function HomePlateLoader({ message = 'Loading Dugout IQ...' }) {
  // Proportions matched to logo: wide flat top, short sides, angled to point
  const points = '10,5 90,5 90,35 50,68 10,35';
  // Approximate perimeter for stroke-dasharray
  const perimeter = 246;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <svg
            width="72"
            height="72"
            viewBox="0 0 100 73"
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
