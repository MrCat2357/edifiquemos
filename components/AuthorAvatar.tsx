"use client";

import { useState } from "react";

export function getInitials(name: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function AuthorAvatar({
  src,
  name,
  size = 40,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);

  const sizeStyle = { width: size, height: size, flexShrink: 0 as const };

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        style={{
          ...sizeStyle,
          borderRadius: "50%",
          objectFit: "cover" as const,
        }}
      />
    );
  }

  // Usa a classe .author-avatar do globals.css como base,
  // sobrepondo apenas width/height/font-size para respeitar o prop `size`.
  return (
    <div
      className="author-avatar"
      style={{
        ...sizeStyle,
        fontSize: Math.round(size * 0.36) + "px",
      }}
    >
      {getInitials(name)}
    </div>
  );
}