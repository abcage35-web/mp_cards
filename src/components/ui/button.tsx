import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border text-sm font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border-teal-500/50 bg-linear-to-r from-teal-600 via-teal-500 to-cyan-500 text-white shadow-[0_18px_40px_-22px_rgba(13,148,136,0.8)] hover:brightness-105",
        secondary:
          "border-slate-200/70 bg-white/80 text-slate-700 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.4)] backdrop-blur-md hover:border-teal-300/70 hover:text-teal-700 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-teal-400/40 dark:hover:text-teal-200",
        ghost:
          "border-transparent bg-transparent text-slate-600 hover:bg-slate-950/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/6 dark:hover:text-white",
      },
      size: {
        sm: "h-10 px-4",
        md: "h-12 px-5",
        lg: "h-14 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);

Button.displayName = "Button";
