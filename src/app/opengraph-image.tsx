import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Roster Flows - AI-Powered NBA Trade Machine";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Background pattern */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              "radial-gradient(circle at 25% 25%, rgba(99, 102, 241, 0.15) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(129, 140, 248, 0.1) 0%, transparent 50%)",
            display: "flex",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          {/* Logo/Brand */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            {/* RF Logo */}
            <svg
              width="100"
              height="80"
              viewBox="0 0 40 32"
              style={{ marginRight: 20 }}
            >
              <defs>
                <linearGradient id="indigoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(243, 75%, 65%)" />
                  <stop offset="100%" stopColor="hsl(243, 75%, 53%)" />
                </linearGradient>
              </defs>
              <path
                d="M8 4 L3 28 L8.5 28 L9.8 19 L12 19 L15.5 28 L21.5 28 L17.5 18.5 C20 17 21.5 14.5 22 11 C22.5 6.5 19.5 4 14 4 L8 4 Z M10.5 8.5 L13 8.5 C16 8.5 17 10 16.7 12.5 C16.4 15 14.5 16 12 16 L10 16 L10.5 8.5 Z"
                fill="url(#indigoGradient)"
              />
              <path
                d="M28 4 L23 28 L28.5 28 L29.8 19 L35 19 L35.5 14.5 L30.3 14.5 L31 8.5 L37 8.5 L37.5 4 L28 4 Z"
                fill="url(#indigoGradient)"
              />
            </svg>
            <span
              style={{
                fontSize: 64,
                fontWeight: 800,
                color: "white",
                fontStyle: "italic",
              }}
            >
              Roster Flows
            </span>
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 32,
              color: "#94a3b8",
              marginBottom: 48,
              display: "flex",
            }}
          >
            AI-Powered NBA Trade Machine
          </div>

          {/* Features */}
          <div
            style={{
              display: "flex",
              gap: 40,
            }}
          >
            {[
              { icon: "🏀", text: "Trade Simulator" },
              { icon: "🤖", text: "AI Analysis" },
              { icon: "💰", text: "Salary Cap" },
            ].map((feature) => (
              <div
                key={feature.text}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: 12,
                  padding: "16px 24px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <span style={{ fontSize: 28, marginRight: 12 }}>
                  {feature.icon}
                </span>
                <span style={{ fontSize: 20, color: "#e2e8f0" }}>
                  {feature.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom gradient accent */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "linear-gradient(90deg, hsl(243, 75%, 59%) 0%, hsl(243, 75%, 70%) 50%, hsl(243, 75%, 59%) 100%)",
            display: "flex",
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
