import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react'

type ThemeContextType = {
  isDarkMode: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false
    const storedTheme = window.localStorage.getItem('sqdis-theme')
    if (storedTheme === 'dark') return true
    if (storedTheme === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
    window.localStorage.setItem('sqdis-theme', isDarkMode ? 'dark' : 'light')
    console.log('ThemeContext: Updated DOM class. isDarkMode:', isDarkMode)
    console.log('ThemeContext: Has dark class?', document.documentElement.classList.contains('dark'))
    console.log('ThemeContext: All classes:', Array.from(document.documentElement.classList))
    console.log('ThemeContext: HTML className:', document.documentElement.className)
  }, [isDarkMode])

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev)
  }

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
