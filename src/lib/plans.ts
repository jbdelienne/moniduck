export type PlanId = 'free' | 'starter' | 'pro' | 'scale'

export interface PlanLimits {
  monitors: number        // -1 = unlimited
  checkIntervalMin: number
  saasDeps: number        // -1 = unlimited
  historyDays: number
  members: number         // -1 = unlimited
  cloudAccounts: number   // 0 = none, -1 = unlimited
  publicReports: boolean
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    monitors: 3,
    checkIntervalMin: 5,
    saasDeps: 3,
    historyDays: 7,
    members: 1,
    cloudAccounts: 0,
    publicReports: false,
  },
  starter: {
    monitors: 10,
    checkIntervalMin: 5,
    saasDeps: 10,
    historyDays: 30,
    members: 1,
    cloudAccounts: 0,
    publicReports: true,
  },
  pro: {
    monitors: 50,
    checkIntervalMin: 1,
    saasDeps: -1,
    historyDays: 90,
    members: 5,
    cloudAccounts: 1,
    publicReports: true,
  },
  scale: {
    monitors: -1,
    checkIntervalMin: 1,
    saasDeps: -1,
    historyDays: 365,
    members: 15,
    cloudAccounts: -1,
    publicReports: true,
  },
}

export const PLAN_NAMES: Record<PlanId, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  scale: 'Scale',
}

export const PLAN_PRICES: Record<Exclude<PlanId, 'free'>, { monthly: number; annual: number }> = {
  starter: { monthly: 29, annual: 23 },
  pro: { monthly: 89, annual: 71 },
  scale: { monthly: 199, annual: 159 },
}

export function isAtLimit(value: number, limit: number): boolean {
  return limit !== -1 && value >= limit
}

export function formatLimit(limit: number): string {
  return limit === -1 ? 'Unlimited' : String(limit)
}
