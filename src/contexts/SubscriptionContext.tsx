import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getStripeEnvironment } from "@/lib/stripe";

export type Plan = "free" | "plus";

interface SubscriptionRow {
  id: string;
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
}

interface SubscriptionContextValue {
  plan: Plan;
  isPlus: boolean;
  isFree: boolean;
  loading: boolean;
  subscription: SubscriptionRow | null;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

function isActiveSub(row: SubscriptionRow | null): boolean {
  if (!row) return false;
  const futureOrNull =
    !row.current_period_end || new Date(row.current_period_end).getTime() > Date.now();
  if (["active", "trialing", "past_due"].includes(row.status) && futureOrNull) return true;
  if (row.status === "canceled" && row.current_period_end && new Date(row.current_period_end).getTime() > Date.now()) {
    return true;
  }
  return false;
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    const env = getStripeEnvironment();
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id,status,price_id,current_period_end,cancel_at_period_end,stripe_customer_id")
      .eq("user_id", user.id)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error) {
      setSubscription((data as SubscriptionRow | null) ?? null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // Realtime — refetch on any subscription row change for this user.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`subscriptions:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => {
          refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const value = useMemo<SubscriptionContextValue>(() => {
    const isPlus = isActiveSub(subscription) && subscription?.price_id === "plus_monthly";
    return {
      plan: isPlus ? "plus" : "free",
      isPlus,
      isFree: !isPlus,
      loading,
      subscription,
      refresh,
    };
  }, [subscription, loading, refresh]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription deve ser usado dentro de <SubscriptionProvider>");
  return ctx;
}