from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    model_validator,
)


def nonblank(value: str) -> str:
    if not value.strip():
        raise ValueError("Expected non-blank text")
    return value


def timestamp_string(value: object) -> str:
    if not isinstance(value, str) or "T" not in value:
        raise ValueError("Expected an ISO 8601 timestamp with timezone")
    return value


Text = Annotated[str, AfterValidator(nonblank)]
Timestamp = Annotated[AwareDatetime, BeforeValidator(timestamp_string)]
Identifier = Annotated[
    str, Field(pattern=r"^[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}$")
]
ReasonCode = Literal[
    "SAME_BUILDING", "SAME_FLOOR", "SAME_AREA",
    "SIMILAR_DESCRIPTION", "SAME_CATEGORY", "RECENT_REPORT",
]


class Payload(BaseModel):
    model_config = ConfigDict(extra="forbid")


class IndoorLocation(Payload):
    kind: Literal["INDOOR"]
    building_id: Identifier
    floor_id: Identifier
    area_id: Identifier
    detail: str | None = None


class OutdoorLocation(Payload):
    kind: Literal["OUTDOOR"]
    detail: Text
    latitude: Annotated[float, Field(ge=-90, le=90, strict=True)] | None = None
    longitude: Annotated[float, Field(ge=-180, le=180, strict=True)] | None = None

    @model_validator(mode="after")
    def coordinates_are_paired(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be supplied together")
        return self


Location = Annotated[IndoorLocation | OutdoorLocation, Field(discriminator="kind")]


class Query(Payload):
    description: Text
    proposed_category_code: Text | None = None
    location: Location


class Candidate(Payload):
    report_id: Identifier
    issue_id: Identifier
    description: Text
    category_code: Text | None = None
    location: Location
    created_at: Timestamp


class DuplicateRequest(Payload):
    request_id: Identifier
    query_time: Timestamp
    query: Query
    candidates: list[Candidate]
    limit: Annotated[int, Field(ge=0, strict=True)]


class Suggestion(Payload):
    report_id: Identifier
    score: Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
    reason_codes: list[ReasonCode]


class DuplicateResponse(Payload):
    request_id: Identifier
    suggestions: list[Suggestion]
    model_version: str


class HealthResponse(Payload):
    status: Literal["ok"] = "ok"
    model_version: str
