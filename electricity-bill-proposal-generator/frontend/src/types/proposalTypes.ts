import type { ClientDetails } from "./billTypes";
import type { CalculatedMetrics } from "./metricsTypes";
import type { Recommendation } from "../data/recommendationRules";

export interface ProposalNarrative {
    executiveSummary: string;
    keyObservations: string[];
    nextSteps: string[];
}

export interface ProposalData {
    client: ClientDetails;
    metrics: CalculatedMetrics;
    recommendations: Recommendation[];
    narrative?: ProposalNarrative;
    generatedAt: string;
}