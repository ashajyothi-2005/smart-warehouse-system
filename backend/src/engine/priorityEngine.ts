export interface PriorityInput {
  customerTier: string; // VIP, ENTERPRISE, REGULAR
  totalValue: number;
  slaDeadline: Date;
  createdTime?: Date;
}

export function calculatePriorityScore(input: PriorityInput): number {
  const tierWeights: Record<string, number> = {
    VIP: 3.5,
    ENTERPRISE: 2.5,
    REGULAR: 1.0,
  };

  const weight = tierWeights[input.customerTier.toUpperCase()] || 1.0;
  const valueFactor = Math.log10(Math.max(input.totalValue, 10)) * 1.2;
  const baseScore = weight * valueFactor;

  // SLA Exponential Time-Decay Calculation
  const now = new Date().getTime();
  const deadline = new Date(input.slaDeadline).getTime();
  const created = input.createdTime ? new Date(input.createdTime).getTime() : now;

  const totalWindow = Math.max(deadline - created, 1);
  const elapsed = Math.max(now - created, 0);

  // Growth rate lambda ensuring exponential escalation as deadline nears
  const lambda = 1.5;
  const timeDecayMultiplier = Math.exp((elapsed / totalWindow) * lambda);

  return Number((baseScore * timeDecayMultiplier).toFixed(3));
}