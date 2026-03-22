import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "Logo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadFont(
  family: string,
  weight: number = 400
): Promise<ArrayBuffer | null> {
  try {
    const familyParam = family.replace(/ /g, "+");
    const cssUrl = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weight}&display=swap`;
    const css = await fetch(cssUrl, { headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => r.text());
    const urlMatch = css.match(/url\((https:\/\/[^)]+)\)\s+format\('(opentype|truetype|woff2?)'\)/);
    const fontUrl = urlMatch?.[1];
    if (!fontUrl) return null;
    const res = await fetch(fontUrl);
    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function Image() {
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";
  const [spaceGroteskData, interData] = await Promise.all([
    loadFont("Space Grotesk", 700),
    loadFont("Inter", 500),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 120,
              fontWeight: 700,
              color: "#141413",
              fontFamily: spaceGroteskData ? "Space Grotesk" : "sans-serif",
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
            }}
          >
            {businessName}
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#4a4a48",
              fontFamily: interData ? "Inter" : "sans-serif",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            AI-Powered RFP Response Assistant
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        ...(spaceGroteskData
          ? [
              {
                name: "Space Grotesk",
                data: spaceGroteskData,
                style: "normal" as const,
                weight: 700 as const,
              },
            ]
          : []),
        ...(interData
          ? [
              {
                name: "Inter",
                data: interData,
                style: "normal" as const,
                weight: 500 as const,
              },
            ]
          : []),
      ],
    }
  );
}
