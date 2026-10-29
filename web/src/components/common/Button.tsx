import type { ButtonHTMLAttributes } from 'react';

type Variant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "light"
  | "outline-primary"
  | "outline-secondary"
  | "outline-danger";

type BtnSize = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: BtnSize;
  block?: boolean;
};

const variantClassMap: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
  ghost: "btn-ghost",
  light: "btn-light",
  "outline-primary": "btn-outline-primary",
  "outline-secondary": "btn-outline-secondary",
  "outline-danger": "btn-outline-danger",
};

const sizeClassMap: Record<BtnSize, string> = {
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg",
};

export default function Button({
  variant = "primary",
  size = "md",
  block = false,
  className = "",
  type = "button",
  ...rest
}: Props) {
  const variantClass = variantClassMap[variant] ?? variantClassMap.primary;
  const sizeClass = sizeClassMap[size] ?? sizeClassMap.md;
  const blockClass = block ? "btn-block" : "";

  const cls = [`btn`, variantClass, sizeClass, blockClass, className]
    .filter(Boolean)
    .join(" ")
    .trim();

  return <button type={type} className={cls} {...rest} />;
}