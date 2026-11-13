export interface GoalProjectionInput {
  readonly currentCorpusPaise: bigint;
  readonly targetTodayPaise: bigint;
  readonly monthlySipPaise: bigint;
  readonly yearsRemaining: number;
  readonly expectedReturnPct: number;
  readonly inflationRatePct: number;
  readonly stepUpRatePct: number;
  readonly startYear?: number;
}

export interface GoalProjectionYearPoint {
  readonly yearIndex: number;
  readonly calendarYear: number;
  readonly flatSipCorpusPaise: bigint;
  readonly stepUpSipCorpusPaise: bigint;
  readonly inflationAdjustedTargetPaise: bigint;
  readonly monthlySipAtYearPaise: bigint;
}

export interface GoalProjectionCurveResult {
  readonly points: readonly GoalProjectionYearPoint[];
  readonly finalFlatCorpusPaise: bigint;
  readonly finalStepUpCorpusPaise: bigint;
  readonly finalInflationTargetPaise: bigint;
  readonly stepUpAdvantagePaise: bigint;
  readonly isFlatOnTrack: boolean;
  readonly isStepUpOnTrack: boolean;
}

/**
 * Simulates year-by-year goal compounding with both a flat monthly SIP and an
 * annual step-up SIP (e.g. +10%/yr) against an inflation-adjusted target corpus.
 */
export function projectGoalMilestoneCurve(
  input: GoalProjectionInput
): GoalProjectionCurveResult {
  const totalYears = Math.max(1, Math.min(50, Math.round(input.yearsRemaining)));
  const baseYear = input.startYear ?? new Date().getFullYear();
  const monthlyRate = input.expectedReturnPct > 0 ? input.expectedReturnPct / (12 * 100) : 0;
  const inflationFactorAnnual = 1 + Math.max(0, input.inflationRatePct) / 100;
  const stepUpFactorAnnual = 1 + Math.max(0, input.stepUpRatePct) / 100;

  let flatCorpus = Number(input.currentCorpusPaise);
  let stepUpCorpus = Number(input.currentCorpusPaise);
  let currentStepUpSip = Number(input.monthlySipPaise);
  const flatSip = Number(input.monthlySipPaise);
  let inflatedTarget = Number(input.targetTodayPaise);

  const points: GoalProjectionYearPoint[] = [
    {
      yearIndex: 0,
      calendarYear: baseYear,
      flatSipCorpusPaise: input.currentCorpusPaise,
      stepUpSipCorpusPaise: input.currentCorpusPaise,
      inflationAdjustedTargetPaise: input.targetTodayPaise,
      monthlySipAtYearPaise: input.monthlySipPaise,
    },
  ];

  for (let y = 1; y <= totalYears; y++) {
    for (let m = 0; m < 12; m++) {
      flatCorpus = (flatCorpus + flatSip) * (1 + monthlyRate);
      stepUpCorpus = (stepUpCorpus + currentStepUpSip) * (1 + monthlyRate);
    }

    inflatedTarget = inflatedTarget * inflationFactorAnnual;

    points.push({
      yearIndex: y,
      calendarYear: baseYear + y,
      flatSipCorpusPaise: BigInt(Math.round(flatCorpus)),
      stepUpSipCorpusPaise: BigInt(Math.round(stepUpCorpus)),
      inflationAdjustedTargetPaise: BigInt(Math.round(inflatedTarget)),
      monthlySipAtYearPaise: BigInt(Math.round(currentStepUpSip)),
    });

    currentStepUpSip = currentStepUpSip * stepUpFactorAnnual;
  }

  const last = points[points.length - 1]!;
  const stepUpAdvantagePaise = last.stepUpSipCorpusPaise - last.flatSipCorpusPaise;

  return {
    points,
    finalFlatCorpusPaise: last.flatSipCorpusPaise,
    finalStepUpCorpusPaise: last.stepUpSipCorpusPaise,
    finalInflationTargetPaise: last.inflationAdjustedTargetPaise,
    stepUpAdvantagePaise,
    isFlatOnTrack: last.flatSipCorpusPaise >= last.inflationAdjustedTargetPaise,
    isStepUpOnTrack: last.stepUpSipCorpusPaise >= last.inflationAdjustedTargetPaise,
  };
}

