"use client";

import type { FormHTMLAttributes, ReactNode } from "react";

export function ConfirmForm({
  message,
  children,
  onSubmit,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & { message: string; children: ReactNode }) {
  return (
    <form
      {...props}
      onSubmit={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
          return;
        }
        onSubmit?.(e);
      }}
    >
      {children}
    </form>
  );
}
