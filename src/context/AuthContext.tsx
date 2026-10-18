import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { Member } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  token: string | null;
  member: Member | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, member: Member) => void;
  logout: () => void;
  setMember: (member: Member | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!token && !!member;

  // Restaura sessão do localStorage ao iniciar
  useEffect(() => {
    const storedToken = localStorage.getItem('brolabs_token');
    const storedMember = localStorage.getItem('brolabs_member');

    if (storedToken && storedMember) {
      try {
        setToken(storedToken);
        setMember(JSON.parse(storedMember));
      } catch {
        localStorage.removeItem('brolabs_token');
        localStorage.removeItem('brolabs_member');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((newToken: string, newMember: Member) => {
    setToken(newToken);
    setMember(newMember);
    localStorage.setItem('brolabs_token', newToken);
    localStorage.setItem('brolabs_member', JSON.stringify(newMember));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setMember(null);
    localStorage.removeItem('brolabs_token');
    localStorage.removeItem('brolabs_member');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        member,
        isAuthenticated,
        isLoading,
        login,
        logout,
        setMember,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
