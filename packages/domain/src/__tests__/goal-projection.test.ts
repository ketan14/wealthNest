import { describe, it, expect } from 'vitest';
import { projectGoalMilestoneCurve } from '../goals/goal-projection.js';

describe('Domain: Goal Milestone Projection Curves & Step-Up SIP', () => {
  it('projects year-by-year compounding and quantifies step-up SIP advantage', () => {
    const result = projectGoalMilestoneCurve({
      currentCorpusPaise: 5_00_000_00n, // ₹5L
      targetTodayPaise: 40_00_000_00n, // ₹40L today
      monthlySipPaise: 25_000_00n, // ₹25,000/mo
      yearsRemaining: 10,
      expectedReturnPct: 12,
      inflationRatePct: 6,
      stepUpRatePct: 10,
      startYear: 2026,
    });

    expect(result.points).toHaveLength(11); // Year 0..10
    expect(result.points[0]?.calendarYear).toBe(2026);
    expect(result.points[10]?.calendarYear).toBe(2036);
    expect(result.finalStepUpCorpusPaise).toBeGreaterThan(result.finalFlatCorpusPaise);
    expect(result.stepUpAdvantagePaise).toBeGreaterThan(0n);
    expect(result.finalInflationTargetPaise).toBeGreaterThan(40_00_000_00n);
  });

  it('produces equal flat and step-up corpus when stepUpRatePct is 0', () => {
    const result = projectGoalMilestoneCurve({
      currentCorpusPaise: 1_00_000_00n,
      targetTodayPaise: 10_00_000_00n,
      monthlySipPaise: 10_000_00n,
      yearsRemaining: 5,
      expectedReturnPct: 10,
      inflationRatePct: 5,
      stepUpRatePct: 0,
    });

    expect(result.stepUpAdvantagePaise).toBe(0n);
    expect(result.finalStepUpCorpusPaise).toBe(result.finalFlatCorpusPaise);
  });
});
