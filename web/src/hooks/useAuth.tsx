import { createContext, useState, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserType } from '../types/auth';

type User = {
  id?: number | string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  userType?: string;
  gender?: string;
};

type AuthContextType = {
  user: User | null;
  userType: UserType;
  isAuthenticated: boolean;
  login: (userData: User, token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  userType: 'Guest',
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

function loadStoredUser(): User | null {
  try {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    if (!token?.trim() || !storedUser) return null;

    const parsed: unknown = JSON.parse(storedUser);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as User;
  } catch {
    // Invalid or inaccessible browser storage must not prevent the login page from rendering.
    return null;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Route guards need the saved session on their first render, before any effects run.
  const [user, setUser] = useState<User | null>(loadStoredUser);
  const navigate = useNavigate();

  const login = useCallback((userData: User, token: string) => {
    const formattedUser = { ...userData };
    localStorage.setItem('access_token', token);
    localStorage.setItem('user', JSON.stringify(formattedUser));
    setUser(formattedUser);
  }, []);

  const logout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/auth/oauth2/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    } catch (err) {
      console.error('Logout network error:', err);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      setUser(null);
      navigate('/');
    }
  };

  function toUserType(value?: string): UserType {
    const v = (value || 'Guest');
    if (v === 'Guest' || v === 'Patient' || v === 'Doctor' || v === 'Receptionist' || v === 'Admin') {
      return v as UserType;
    }
    return 'Guest';
  }

  const userType: UserType = toUserType(user?.userType);
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, userType, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
