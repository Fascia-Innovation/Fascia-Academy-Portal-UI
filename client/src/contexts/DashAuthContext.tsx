import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";

export type DashUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "course_leader" | "affiliate";
  affiliateCode?: string | null;
  ghlContactId?: string | null;
};

type DashAuthContextType = {
  user: DashUser | null;
  loading: boolean;
  refetch: () => void;
};

const DashAuthContext = createContext<DashAuthContextType>({
  user: null,
  loading: true,
  refetch: () => {},
});

export function DashAuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, refetch } = trpc.dashboard.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <DashAuthContext.Provider
      value={{
        user: data ?? null,
        loading: isLoading,
        refetch,
      }}
    >
      {children}
    </DashAuthContext.Provider>
  );
}

export function useDashAuth() {
  return useContext(DashAuthContext);
}
