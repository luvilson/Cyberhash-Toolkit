"""Pydantic schemas — request/response validation for the API layer."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

SUPPORTED_ALGORITHMS = [
    "MD5", "SHA1", "SHA224", "SHA256", "SHA384", "SHA512",
    "SHA3-256", "SHA3-512", "BLAKE2b", "BLAKE2s",
]


# ---------- Hash generation ----------

class HashGenerateRequest(BaseModel):
    text: str = Field(..., min_length=0, max_length=200_000)
    algorithm: str = Field(..., description="One of the supported algorithms")

    @field_validator("algorithm")
    @classmethod
    def check_algorithm(cls, v: str) -> str:
        if v not in SUPPORTED_ALGORITHMS:
            raise ValueError(f"Unsupported algorithm '{v}'. Supported: {SUPPORTED_ALGORITHMS}")
        return v


class HashGenerateAllRequest(BaseModel):
    """Generate the same text with every supported algorithm at once (used by 'live' mode)."""
    text: str = Field(..., min_length=0, max_length=200_000)


class HashResult(BaseModel):
    algorithm: str
    hash: str
    length: int
    status: str = "success"


class HashGenerateAllResponse(BaseModel):
    results: List[HashResult]


class FileHashResult(BaseModel):
    filename: str
    size_bytes: int
    results: List[HashResult]


# ---------- Identification ----------

class HashIdentifyRequest(BaseModel):
    hash: str = Field(..., min_length=1, max_length=1024)


class HashIdentifyResponse(BaseModel):
    hash: str
    algorithm: str
    confidence: int
    length: int
    charset: str
    possible_algorithms: List[str]
    reasoning: List[str]
    warning: Optional[str] = None
    status: str = "identified"


# ---------- Comparison ----------

class HashCompareRequest(BaseModel):
    first_hash: str = Field(..., min_length=1, max_length=1024)
    second_hash: str = Field(..., min_length=1, max_length=1024)
    case_sensitive: bool = False


class HashCompareResponse(BaseModel):
    match: bool
    normalized_first: str
    normalized_second: str
    status: str


# ---------- Dictionary decode (bounded, educational) ----------

class HashDecodeRequest(BaseModel):
    hash: str = Field(..., min_length=1, max_length=1024)


class HashDecodeResponse(BaseModel):
    hash: str
    found: bool
    plaintext: Optional[str] = None
    algorithm_guess: Optional[str] = None
    entries_checked: int
    status: str


# ---------- Encoding / decoding (reversible, non-cryptographic) ----------

ENCODING_TYPES = ["Base64", "Hex", "URL Encoding", "ROT13"]


class EncodeDecodeRequest(BaseModel):
    text: str = Field(..., max_length=200_000)
    encoding: str
    mode: str = Field(..., description="'encode' or 'decode'")

    @field_validator("encoding")
    @classmethod
    def check_encoding(cls, v: str) -> str:
        if v not in ENCODING_TYPES:
            raise ValueError(f"Unsupported encoding '{v}'. Supported: {ENCODING_TYPES}")
        return v

    @field_validator("mode")
    @classmethod
    def check_mode(cls, v: str) -> str:
        if v not in ("encode", "decode"):
            raise ValueError("mode must be 'encode' or 'decode'")
        return v


class EncodeDecodeResponse(BaseModel):
    input: str
    output: str
    encoding: str
    mode: str  # "encode" | "decode"
    status: str


# ---------- Wordlist attack demo (bounded) ----------

class WordlistAttackRequest(BaseModel):
    target_hash: str = Field(..., min_length=1, max_length=1024)
    algorithm: str
    wordlist: Optional[str] = Field(default="common-passwords", description="Preset wordlist name")
    custom_candidates: Optional[List[str]] = Field(default=None, max_length=20000)

    @field_validator("algorithm")
    @classmethod
    def check_algorithm(cls, v: str) -> str:
        allowed = ["MD5", "SHA1", "SHA256", "SHA512"]
        if v not in allowed:
            raise ValueError(f"Unsupported algorithm '{v}'. Supported: {allowed}")
        return v


class WordlistAttackResponse(BaseModel):
    target_hash: str
    algorithm: str
    matched: bool
    candidate: Optional[str] = None
    attempts: int
    total_candidates: int
    time_ms: float
    status: str


# ---------- Brute-force demo (tightly bounded) ----------

class BruteForceRequest(BaseModel):
    target_hash: str = Field(..., min_length=1, max_length=1024)
    algorithm: str
    max_length: int = Field(..., ge=1, le=5)
    charset: str = Field(default="abcdefghijklmnopqrstuvwxyz0123456789", max_length=64)

    @field_validator("algorithm")
    @classmethod
    def check_algorithm(cls, v: str) -> str:
        if v not in SUPPORTED_ALGORITHMS:
            raise ValueError(f"Unsupported algorithm '{v}'. Supported: {SUPPORTED_ALGORITHMS}")
        return v

    @field_validator("charset")
    @classmethod
    def check_charset(cls, v: str) -> str:
        if not v or len(set(v)) != len(v):
            raise ValueError("Charset must be non-empty with unique characters")
        return v


class BruteForceResponse(BaseModel):
    target_hash: str
    algorithm: str
    matched: bool
    candidate: Optional[str] = None
    candidates_tested: int
    search_space: int
    time_ms: float
    status: str


# ---------- History ----------

class HistoryEntryOut(BaseModel):
    id: int
    timestamp: datetime
    operation: str
    algorithm: Optional[str] = None
    input_type: str
    input_preview: Optional[str] = None
    result: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class HistoryListResponse(BaseModel):
    entries: List[HistoryEntryOut]
    total: int
