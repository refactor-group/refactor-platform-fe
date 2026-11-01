"use client"

import { useEffect } from "react"
import type { ComponentProps, CSSProperties } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"
import { handleToastEscape } from "@/lib/toast"

type ToasterProps = ComponentProps<typeof Sonner>

// Full-width items let the content-sized pill centre itself.
const TOASTER_STYLE = { "--width": "min(560px, calc(100vw - 32px))" } as CSSProperties

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  useEffect(() => {
    window.addEventListener("keydown", handleToastEscape)
    return () => window.removeEventListener("keydown", handleToastEscape)
  }, [])

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      offset={24}
      mobileOffset={16}
      visibleToasts={3}
      swipeDirections={[]}
      style={TOASTER_STYLE}
      toastOptions={{ unstyled: true, className: "pointer-events-none w-full" }}
      {...props}
    />
  )
}

export { Toaster }
