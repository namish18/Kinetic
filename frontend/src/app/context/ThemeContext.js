"use client";
import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState("dark");

    useEffect(() => {
        const saved = localStorage.getItem("kinetic-theme");
        if (saved) setTheme(saved);
    }, []);

    useEffect(() => {
        document.body.className = theme;
        localStorage.setItem("kinetic-theme", theme);
    }, [theme]);

    const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
