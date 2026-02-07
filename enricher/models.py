from pydantic import BaseModel, Field
from typing import List, Optional, Literal


SuggestedAction = Literal["Call", "Email", "Schedule Meeting", "Send Proposal"]
LeadSource = Literal["eprocure", "tender_portal", "news", "other"]
SignalType = Literal["Tender", "Keywords", "Work Description", "Budget Signal"]


class SignalDetails(BaseModel):
    """Additional details for a signal"""

    tender_value: Optional[str] = Field(
        None, description="EMD amount or estimated value"
    )
    quantity: Optional[str] = Field(
        None, description="Quantity from workDescription (e.g., 1400 MT)"
    )
    delivery_period: Optional[str] = Field(
        None, description="Delivery period from periodOfWorkDays or workDescription"
    )
    organization: Optional[str] = Field(
        None, description="Organization from organisation field"
    )


class Signal(BaseModel):
    """Signal extracted from tender data indicating relevance to HPCL products"""

    type: SignalType = Field(..., description="Type of signal")
    keyword: str = Field(
        ..., description="Extracted keyword from title/workDescription/keywords"
    )
    source: str = Field(..., description="Plain English extraction source")
    summary: str = Field(..., description="Why this matters for HPCL")
    date: str = Field(
        ..., description="ISO format date (bidSubmissionEndDate or publishedDate)"
    )
    trust_score: int = Field(
        ..., ge=0, le=100, description="Confidence in extraction (0-100)"
    )
    details: Optional[SignalDetails] = Field(
        None, description="Additional signal details"
    )


class ProductRecommendation(BaseModel):
    """Product recommendation based on tender analysis"""

    product_name: str = Field(
        ..., description="Product name (e.g., 'Low Sulphur Heavy Stock Oil (LSHS)')"
    )
    confidence: int = Field(..., ge=0, le=100, description="Match confidence (0-100)")
    reason_code: str = Field(..., description="Plain English reason for recommendation")
    estimated_volume: str = Field(
        ..., description="Estimated volume (e.g., '1400 MT/2 years')"
    )
    margin_potential: Literal["High", "Medium", "Low"] = Field(
        ..., description="Potential margin for this product"
    )
    match_evidence: List[str] = Field(
        ..., description="Array of phrases from tender supporting this recommendation"
    )
    competitor_risk: Optional[str] = Field(
        None, description="Competitor risk assessment"
    )


class NextActions(BaseModel):
    """Auto-generated next actions for sales team"""

    suggested_action: SuggestedAction = Field(..., description="Suggested action type")
    timing: str = Field(
        ..., description="Timing for action (e.g., 'Within 24 hours', 'Before Feb 8')"
    )
    context: str = Field(
        ...,
        description="Context for action (e.g., 'Tender response deadline: Feb 9, 1:00 PM')",
    )
    contact_trigger: str = Field(
        ...,
        description="Contact trigger (e.g., 'Procurement Manager', 'Technical Lead')",
    )
    reference_number: str = Field(
        ..., description="Tender reference number for context"
    )


class AIGeneratedLeadData(BaseModel):
    """AI-generated enrichment data for tender leads"""

    # Lead Scoring & Classification
    lead_score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Lead score (0-100) derived from tender relevance to HPCL products",
    )
    urgency: Literal["High", "Medium", "Low"] = Field(
        ..., description="Urgency level based on bidSubmissionEndDate and EMDAmount"
    )
    confidence: int = Field(
        ..., ge=0, le=100, description="Confidence in lead quality (0-100)"
    )

    # Why This Lead Exists (Signals Extraction)
    signals: List[Signal] = Field(..., description="List of extracted signals")

    # Product Recommendations from Tender Analysis
    products_recommended: List[ProductRecommendation] = Field(
        ..., description="List of recommended products"
    )

    # Next Actions Auto-Generation
    next_actions: NextActions = Field(..., description="Auto-generated next actions")

    # Sales Routing (AI Assignment)
    sales_owner: str = Field(..., description="Assigned regional manager")
    field_officer: str = Field(..., description="Assigned sales officer")
    region: str = Field(..., description="Extracted/mapped region")

    # Lead Metadata
    created_at: str = Field(..., description="ISO timestamp of lead creation")
    source: LeadSource = Field(..., description="Source of the tender/lead")
    tender_reference: str = Field(
        ..., description="Tender reference number from tenderReferenceNumber"
    )
    procurement_channel: str = Field(
        ..., description="Procurement channel (e.g., 'eProcure Government Tender')"
    )


class RequestBody(BaseModel):
    """Input tender fields from eProcure portal"""

    keyword: Optional[str] = Field(None, description="Search keyword")
    title: str = Field(..., description="Tender title")
    workTitle: Optional[str] = Field(None, description="Work title")
    workDescription: str = Field(..., description="Work description")
    reference: Optional[str] = Field(None, description="Tender reference")
    tenderReferenceNumber: str = Field(..., description="Tender reference number")
    tenderId: str = Field(..., description="Tender ID")
    publishedDate: Optional[str] = Field(None, description="Published date")
    publishedDateFull: Optional[str] = Field(None, description="Full published date")
    closingDate: Optional[str] = Field(None, description="Closing date")
    openingDate: Optional[str] = Field(None, description="Opening date")
    bidSubmissionStartDate: Optional[str] = Field(
        None, description="Bid submission start date"
    )
    bidSubmissionEndDate: str = Field(..., description="Bid submission end date")
    bidOpeningDateFull: Optional[str] = Field(None, description="Full bid opening date")
    docDownloadStartDate: Optional[str] = Field(
        None, description="Document download start date"
    )
    docDownloadEndDate: Optional[str] = Field(
        None, description="Document download end date"
    )
    organisation: str = Field(..., description="Organization name")
    organisationChain: Optional[str] = Field(None, description="Organization chain")
    tenderType: str = Field(..., description="Type of tender")
    tenderCategory: Optional[str] = Field(None, description="Tender category")
    contractType: Optional[str] = Field(None, description="Contract type")
    formOfContract: Optional[str] = Field(None, description="Form of contract")
    productCategory: str = Field(..., description="Product category")
    withdrawalAllowed: Optional[str] = Field(
        None, description="Whether withdrawal is allowed"
    )
    emdAmount: str = Field(..., description="EMD amount")
    emdPayableTo: Optional[str] = Field(None, description="EMD payable to")
    emdPayableAt: Optional[str] = Field(None, description="EMD payable at")
    tenderValue: Optional[str] = Field(None, description="Tender value")
    tenderFee: Optional[str] = Field(None, description="Tender fee")
    feePayableTo: Optional[str] = Field(None, description="Fee payable to")
    feePayableAt: Optional[str] = Field(None, description="Fee payable at")
    periodOfWorkDays: str = Field(..., description="Period of work in days")
    bidValidityDays: Optional[str] = Field(None, description="Bid validity in days")
    workLocation: Optional[str] = Field(None, description="Work location")
    pincode: Optional[str] = Field(None, description="Pincode")
    bidOpeningPlace: Optional[str] = Field(None, description="Bid opening place")
    paymentInstruments: Optional[List[str]] = Field(
        None, description="Accepted payment instruments"
    )
