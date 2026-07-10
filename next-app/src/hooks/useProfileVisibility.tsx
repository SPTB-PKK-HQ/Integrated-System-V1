'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ProfileVisibilityValue {
  profileVisible: boolean;
  showProfile: () => void;
}

const ProfileContext = createContext<ProfileVisibilityValue | null>(null);

const STORAGE_KEY = 'profile_tab_visible';

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profileVisible, setProfileVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    }
    return false;
  });

  const showProfile = useCallback(() => {
    setProfileVisible(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  return (
    <ProfileContext.Provider value={{ profileVisible, showProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfileVisibility(): ProfileVisibilityValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfileVisibility must be used within ProfileProvider');
  return ctx;
}
