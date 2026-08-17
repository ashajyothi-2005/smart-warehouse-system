import { PriorityTier } from '@prisma/client';

export interface PriorityInput {
  customerTier: PriorityTier;
  totalValue: number;
  slaDeadline: Date;
}

const TIER_WEIGHTS: Record<PriorityTier, number> = {
  ENTERPRISE: 3.0,
  VIP: 2.0,
  STANDARD: 1.0,
};

const WEIGHTS = {
  sla: 0.5,
  value: 0.3,
  tier: 0.2,
};

export function calculatePriorityScore(input: PriorityInput): number {
  const now = new Date();
  const hoursRemaining = Math.max(0.1, (input.slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60));

  const slaScore = 1 / hoursRemaining;
  const valueScore = input.totalValue / 100; // Normalized value factor
  const tierScore = TIER_WEIGHTS[input.customerTier];

  const totalScore = (slaScore * WEIGHTS.sla) + (valueScore * WEIGHTS.value) + (tierScore * WEIGHTS.tier);

  return Math.round(totalScore * 100) / 100;
}