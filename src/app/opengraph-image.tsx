import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "RosterFlow - AI-Powered NBA Trade Machine";
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
              "radial-gradient(circle at 25% 25%, rgba(251, 146, 60, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(59, 130, 246, 0.1) 0%, transparent 50%)",
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
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: 16,
                background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 20,
              }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 3L4 7l4 4" />
                <path d="M4 7h16" />
                <path d="M16 21l4-4-4-4" />
                <path d="M20 17H4" />
              </svg>
            </div>
            <span
              style={{
                fontSize: 64,
                fontWeight: 800,
                color: "white",
                fontStyle: "italic",
              }}
            >
              RosterFlow
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
            background: "linear-gradient(90deg, #f97316 0%, #3b82f6 50%, #f97316 100%)",
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
