import { ColorResolvable } from "discord.js";

// Comments beside colors are TailwindCSS default color palette values.
// https://tailwindcss.com/docs/customizing-colors#default-color-palette

export type Colors = {
  primary: ColorResolvable;
  secondary: ColorResolvable;
  success: ColorResolvable;
  error: ColorResolvable;
  warning: ColorResolvable;
  orange: ColorResolvable;
  brown: ColorResolvable;
  green: ColorResolvable;
  blue: ColorResolvable;
  violet: ColorResolvable;
  fuchsia: ColorResolvable;
  pink: ColorResolvable;
  darkModeBg: ColorResolvable;
  firstBlood: ColorResolvable;
};

const colors: Colors = {
  primary: "#22d3ee", // Cyan 400
  secondary: "#0e7490", // Cyan 700
  success: "#22c55e", // Green 500
  error: "#ef4444", // Red 600
  warning: "#facc15", // Yellow 400
  orange: "#f97316", // Orange 500
  brown: "#78350f", // Amber 900
  green: "#10b981", // Green 500
  blue: "#2563eb", // Blue 600
  violet: "#7c3aed", // Violet 600
  fuchsia: "#d946ef", // Fuchsia 500
  pink: "#db2777", // Pink 600
  darkModeBg: "#2b2d31", // Discord dark mode embed background colour
  firstBlood: "#992d22", // First Blood role color in CSD server
} as const;

export default colors;
