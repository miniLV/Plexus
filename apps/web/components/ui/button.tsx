"use client";

import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";

/**
 * Button — vendored from shadcn/ui (ADR-005), re-skinned with Plexus tokens.
 *
 * Variants: primary (coral), secondary (surface-2), ghost, danger.
 * Sizes:    default (h-9), sm (h-8), lg (h-10), icon (h-9 w-9).
 */
const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium",
    "transition-colors duration-plexus-normal ease-plexus-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plexus-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-plexus-bg",
    "disabled:pointer-events-none disabled:opacity-50",
  ),
  {
    variants: {
      variant: {
        primary:
          "bg-plexus-accent text-[#1a1a17] hover:bg-plexus-accent-2 border border-plexus-accent",
        secondary:
          "bg-plexus-surface-2 text-plexus-text border border-plexus-border hover:bg-plexus-surface hover:border-plexus-border-strong",
        ghost:
          "bg-transparent text-plexus-text-2 hover:bg-plexus-surface-2 hover:text-plexus-text border border-transparent",
        danger: "bg-transparent text-plexus-err border border-plexus-err/35 hover:bg-plexus-err/10",
        "danger-solid": "bg-plexus-err text-white border border-plexus-err hover:bg-plexus-err/90",
      },
      size: {
        default: "h-9 px-3.5 text-sm",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-10 px-4 text-sm",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
