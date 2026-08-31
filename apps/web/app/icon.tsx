import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#0b0c0f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#c9a36a",
          fontSize: 20,
          fontFamily: "serif",
        }}
      >
        S
      </div>
    ),
    size
  );
}
