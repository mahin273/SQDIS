from fastapi import APIRouter, HTTPException
from app.schemas.knowledge_silo import (
    BusFactorAnalysisRequest, BusFactorAnalysisResponse,
    ModuleContribution, ModuleBusFactorResult
)
from app.models.knowledge_silo import bus_factor_engine
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ml/teams", tags=["Team Knowledge Silos & Bus Factor"])


@router.post("/bus-factor", response_model=BusFactorAnalysisResponse)
async def analyze_team_bus_factor(request: BusFactorAnalysisRequest) -> BusFactorAnalysisResponse:
    """
    Evaluate repository-wide knowledge concentration, key-person risk, and Gini inequality.
    Computes the Avelino/Valente 80% contribution frontier across Git commits and churn.
    """
    try:
        result = bus_factor_engine.analyze_repository(request)
        return result
    except Exception as e:
        logger.error(f"Bus Factor Analysis failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Bus Factor Analysis failed: {str(e)}"
        )


@router.post("/bus-factor/module", response_model=ModuleBusFactorResult)
async def analyze_single_module_bus_factor(request: ModuleContribution) -> ModuleBusFactorResult:
    """
    Evaluate Bus Factor and knowledge silos for a single module or subsystem.
    """
    try:
        result = bus_factor_engine.analyze_module(request)
        return result
    except Exception as e:
        logger.error(f"Module Bus Factor Analysis failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Module Bus Factor Analysis failed: {str(e)}"
        )


@router.get("/bus-factor/info")
async def get_bus_factor_info():
    """Returns methodology and empirical thresholds for Bus Factor analysis."""
    return {
        "engine": "SQDIS Knowledge Silo & Bus Factor Scoring Engine",
        "methodology": "Degree of Authorship (DOA) + Avelino et al. 80% Cumulative Contribution Frontier",
        "dispersion_metric": "Econometric Gini Concentration Coefficient (0.0=Equal, 1.0=Monopoly)",
        "thresholds": {
            "critical_silo": "Bus Factor == 1 (Single developer holds >= 80% knowledge)",
            "vulnerable": "Bus Factor == 2 (Two developers hold >= 80% knowledge)",
            "resilient": "Bus Factor >= 3 (Distributed knowledge across 3+ engineers)"
        },
        "formula": "Cr(d) = 0.5 * (Commits(d) / TotalCommits) + 0.5 * (Churn(d) / TotalChurn)"
    }
