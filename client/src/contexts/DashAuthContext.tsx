import { createContext, useContext, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";

export type DashUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "course_leader" | "affiliate";
  affiliateCode?: string | null;
  ghlContactId?: string | null;
  isAffiliate?: boolean;
  canExamineExams?: boolean;
};

type DashAuthContextType = {
  user: DashUser | null;
  loading: boolean;
  isImpersonating: boolean;
  refetch: () => void;
};

const DashAuthContext = createContext<DashAuthContextType>({
  user: null,
  loading: true,
  isImpersonating: false,
  refetch: () => {},
});

export function DashAuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, refetch } = trpc.dashboard.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Check if we're in impersonation mode by looking for the admin restore cookie
  // We detect this via a dedicated query that checks the server-side cookie
  const { data: impersonationData } = trpc.admin.checkImpersonation.useQuery(undefined, {
    retry: false,
    staleTime: 0,
  });

  return (
    <DashAuthContext.Provider
      value={{
        user: data ?? null,
        loading: isLoading,
        isImpersonating: impersonationData?.isImpersonating ?? false,
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
