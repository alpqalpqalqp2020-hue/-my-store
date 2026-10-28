import { HOOK_LENGTH, HOOK_Z } from "./ChromeHook";

// مقاسات ترتيب القضيب، يشترك فيها القضيب والمنصة
export const RAIL_Y = 1.75;
export const SPACING = 0.7; // المسافة بين القطع

export const railX = (index, count) => (index - (count - 1) / 2) * SPACING;

// موضع نقطة تعليق الشماعة (أعلى الشماعة) في العالم
export const hangPosition = (index, count) => [
  railX(index, count),
  RAIL_Y - HOOK_LENGTH,
  HOOK_Z + 0.006,
];
