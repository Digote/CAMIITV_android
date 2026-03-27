import React, { ReactNode, createContext, useContext, useState } from 'react';
import { ThemeType, lightTheme } from './index';

interface ThemeContextProps {
  theme: ThemeType;
  toggleTheme?: () => void;
}

const ThemeContext = createContext<ThemeContextProps>({ theme: lightTheme });

interface Props { children: ReactNode; }

export const ThemeProvider = ({ children }: Props) => {
  const [theme, setTheme] = useState<ThemeType>(lightTheme);

  // Caso queira suportar dark: adicionar darkTheme e lógica
  const toggleTheme = () => {
    // Exemplo: sem dark, apenas placeholder
    setTheme(lightTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);