import React, { createContext, useContext } from "react"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

// Recreate the theme context type to avoid circular imports
type Theme = "dark" | "light" | "system"
type ThemeContextType = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

// Access the theme context directly - this matches the context in theme-provider.tsx
const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Safe theme hook that returns a default if context is not available
const useSafeTheme = (): { theme: Theme } => {
  // Try to use the actual theme provider context
  try {
    const { useTheme } = require("@/components/theme-provider")
    const context = useTheme()
    return { theme: context.theme }
  } catch {
    // Fallback to light theme if provider is not available
    return { theme: "light" }
  }
}

const Toaster = ({ ...props }: ToasterProps) => {
  // Use a state-based approach to avoid hook ordering issues
  const [theme, setTheme] = React.useState<Theme>("light")
  
  React.useEffect(() => {
    // Check if we're in a browser and can access localStorage
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme")
      if (savedTheme === "dark" || savedTheme === "light" || savedTheme === "system") {
        setTheme(savedTheme)
      }
    }
  }, [])

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
