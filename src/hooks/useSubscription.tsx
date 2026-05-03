import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuth } from "@/contexts/AuthContext";

export type Plan = "free" | "plus";

export interface SubscriptionState {
  plan: Plan;
  isPlus: boolean;
  isActive: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function isSubscriptionActive(row: {
  status: string | null;
  current_period_end: string | null;
}): boolean {
  if (!row.status) return false;
  const end = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
  const future = end === null || end > Date.now();
  if (ACTIVE_STATUSES.has(row.status) && future) return true;
  if (row.status === "canceled" && end !== null && end > Date.now()) return true;
  return false;
}

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const [state, setState] = useState<Omit<SubscriptionState, "refresh">>({
    plan: "free",
    isPlus: false,
    isActive: false,
    status: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    loading: true,
  });

  const load = useCallback(async () => {
    if (!user) {
      setState({
        plan: "free", isPlus: false, isActive: false, status: null,
        currentPeriodEnd: null, cancelAtPeriodEnd: false, loading: false,
      });
      return;
    }
    const { data } = await supabase
      .from("subscriptions")
      .select("status,current_period_end,cancel_at_period_end,price_id")
      .eq("user_id", user.id)
      .eq("environment", getStripeEnvironment())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      setState({
        plan: "free", isPlus: false, isActive: false, status: null,
        currentPeriodEnd: null, cancelAtPeriodEnd: false, loading: false,
      });
      return;
    }
    const active = isSubscriptionActive({
      status: data.status,
      current_period_end: data.current_period_end as string | null,
    });
    const isPlus = active && data.price_id === "plus_monthly";
    setState({
      plan: isPlus ? "plus" : "free",
      isPlus,
      isActive: active,
      status: data.status,
      currentPeriodEnd: data.current_period_end as string | null,
      cancelAtPeriodEnd: !!data.cancel_at_period_end,
      loading: false,
    });
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel(`subscriptions:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  return { ...state, refresh: load };
}