import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
  google_id?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  googleLogin: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Hardcoded user for demo purposes
  const [user, setUser] = useState<User | null>({
    id: 1,
    username: 'demo_user',
    email: 'demo@example.com',
    is_active: true,
    created_at: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Skip authentication check - user is already set
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    // Hardcoded login - always succeeds
    console.log('Login attempt:', username, password);
    // User is already set, no need to do anything
  };

  const register = async (username: string, email: string, password: string) => {
    // Hardcoded registration - always succeeds
    console.log('Registration attempt:', username, email, password);
    // User is already set, no need to do anything
  };

  const logout = () => {
    // Reset to hardcoded user instead of null
    setUser({
      id: 1,
      username: 'demo_user',
      email: 'demo@example.com',
      is_active: true,
      created_at: new Date().toISOString(),
    });
  };

  const googleLogin = () => {
    // Hardcoded Google login - always succeeds
    console.log('Google login attempt');
    // User is already set, no need to do anything
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    googleLogin,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
