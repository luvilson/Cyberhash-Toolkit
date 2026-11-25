"""API route definitions for CyberHash Toolkit."""
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Query
from sqlalchemy import desc, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import HistoryEntry
from app.schemas import (
    BruteForceRequest, BruteForceResponse,
    EncodeDecodeRequest, EncodeDecodeResponse,
    FileHashResult,
    HashCompareRequest, HashCompareResponse,
    HashDecodeRequest, HashDecodeResponse,
    HashGenerateAllRequest, HashGenerateAllResponse,
    HashGenerateRequest, HashResult,
    HashIdentifyRequest, HashIdentifyResponse,
    HistoryEntryOut, HistoryListResponse,
    WordlistAttackRequest, WordlistAttackResponse,
)
from app.services import encoding as encoding_service
from app.services import hashing as hashing_service
from app.services import identify as identify_service
from app.services import wordlist as wordlist_service

router = APIRouter(prefix="/api")


def _log(db: Session, operation: str, algorithm: Optional[str], input_type: str,
         input_preview: Optional[str], result: Optional[str], status: str) -> None:
    """Best-effort history logging — never lets a logging failure break the request."""
    try:
        preview = (input_preview or "")[:120]
        entry = HistoryEntry(
            operation=operation, algorithm=algorithm, input_type=input_type,
            input_preview=preview, result=(result or "")[:500], status=status,
        )
        db.add(entry)
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()


# ---------------------------------------------------------------------------
# Hash generation
# ---------------------------------------------------------------------------

@router.post("/hash/generate", response_model=HashResult)
def generate_hash(payload: HashGenerateRequest, db: Session = Depends(get_db)):
    try:
        digest = hashing_service.hash_text(payload.text, payload.algorithm)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    result = HashResult(algorithm=payload.algorithm, hash=digest, length=len(digest))
    _log(db, "Hash Generation", payload.algorithm, "text", payload.text, digest, "success")
    return result


@router.post("/hash/generate-all", response_model=HashGenerateAllResponse)
def generate_hash_all(payload: HashGenerateAllRequest, db: Session = Depends(get_db)):
    pairs = hashing_service.hash_text_all(payload.text)
    results = [HashResult(algorithm=algo, hash=h, length=len(h)) for algo, h in pairs]
    _log(db, "Hash Generation (all algorithms)", "ALL", "text", payload.text,
         f"{len(results)} digests generated", "success")
    return HashGenerateAllResponse(results=results)


@router.post("/hash/file", response_model=FileHashResult)
async def hash_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        pairs, size = hashing_service.hash_file_bytes_all(file.file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        await file.close()

    results = [HashResult(algorithm=algo, hash=h, length=len(h)) for algo, h in pairs]
    _log(db, "Hash Generation", "ALL", "file", file.filename,
         f"{size} bytes hashed with {len(results)} algorithms", "success")
    return FileHashResult(filename=file.filename, size_bytes=size, results=results)


# ---------------------------------------------------------------------------
# Identification & comparison
# ---------------------------------------------------------------------------

@router.post("/hash/identify", response_model=HashIdentifyResponse)
def identify_hash(payload: HashIdentifyRequest, db: Session = Depends(get_db)):
    result = identify_service.identify_hash(payload.hash)
    response = HashIdentifyResponse(
        hash=payload.hash.strip(),
        algorithm=result.algorithm,
        confidence=result.confidence,
        length=result.length,
        charset=result.charset,
        possible_algorithms=result.possible_algorithms,
        reasoning=result.reasoning,
        warning=result.warning,
        status="identified" if result.algorithm != "Unknown" else "unknown",
    )
    _log(db, "Hash Identification", result.algorithm, "hash", payload.hash,
         f"{result.confidence}% confidence -> {result.algorithm}", "success")
    return response


@router.post("/hash/compare", response_model=HashCompareResponse)
def compare_hash(payload: HashCompareRequest, db: Session = Depends(get_db)):
    is_match = identify_service.compare_hashes(
        payload.first_hash, payload.second_hash, payload.case_sensitive
    )
    response = HashCompareResponse(
        match=is_match,
        normalized_first=payload.first_hash.strip() if payload.case_sensitive else payload.first_hash.strip().lower(),
        normalized_second=payload.second_hash.strip() if payload.case_sensitive else payload.second_hash.strip().lower(),
        status="match" if is_match else "no_match",
    )
    _log(db, "Hash Comparison", None, "hash",
         f"{payload.first_hash} vs {payload.second_hash}",
         "Match" if is_match else "No match", response.status)
    return response


# ---------------------------------------------------------------------------
# Dictionary decode (bounded, educational)
# ---------------------------------------------------------------------------

@router.post("/hash/decode", response_model=HashDecodeResponse)
def decode_hash(payload: HashDecodeRequest, db: Session = Depends(get_db)):
    found, plaintext, algo_guess, checked = wordlist_service.decode_hash(payload.hash)
    response = HashDecodeResponse(
        hash=payload.hash.strip(),
        found=found,
        plaintext=plaintext,
        algorithm_guess=algo_guess,
        entries_checked=checked,
        status="found" if found else "not_found",
    )
    _log(db, "Educational Dictionary Demo", algo_guess, "hash", payload.hash,
         f"Found: {plaintext}" if found else f"No match in {checked} checks", response.status)
    return response


# ---------------------------------------------------------------------------
# Reversible encoding / decoding
# ---------------------------------------------------------------------------

@router.post("/hash/encode", response_model=EncodeDecodeResponse)
def encode_decode(payload: EncodeDecodeRequest, db: Session = Depends(get_db)):
    try:
        if payload.mode == "encode":
            output = encoding_service.encode(payload.text, payload.encoding)
        else:
            output = encoding_service.decode(payload.text, payload.encoding)
    except encoding_service.EncodingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    response = EncodeDecodeResponse(
        input=payload.text, output=output, encoding=payload.encoding,
        mode=payload.mode, status="success",
    )
    _log(db, f"Encoding ({payload.mode})", payload.encoding, "text", payload.text, output, "success")
    return response


# ---------------------------------------------------------------------------
# Bounded educational demos
# ---------------------------------------------------------------------------

@router.post("/demo/wordlist", response_model=WordlistAttackResponse)
def demo_wordlist(payload: WordlistAttackRequest, db: Session = Depends(get_db)):
    result = wordlist_service.wordlist_attack(
        payload.target_hash, payload.algorithm, payload.wordlist, payload.custom_candidates,
    )
    _log(db, "Educational Dictionary Demo", payload.algorithm, "hash", payload.target_hash,
         f"Match: {result['candidate']}" if result["matched"] else "No match", result["status"])
    return WordlistAttackResponse(**result)


@router.post("/demo/bruteforce", response_model=BruteForceResponse)
def demo_bruteforce(payload: BruteForceRequest, db: Session = Depends(get_db)):
    result = wordlist_service.brute_force_demo(
        payload.target_hash, payload.algorithm, payload.max_length, payload.charset,
    )
    _log(db, "Educational Dictionary Demo", payload.algorithm, "hash", payload.target_hash,
         f"Match: {result['candidate']}" if result["matched"] else "No match", result["status"])
    return BruteForceResponse(**result)


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------

@router.get("/history", response_model=HistoryListResponse)
def get_history(
    search: Optional[str] = Query(default=None, max_length=200),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(HistoryEntry)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                HistoryEntry.operation.ilike(like),
                HistoryEntry.algorithm.ilike(like),
                HistoryEntry.input_preview.ilike(like),
                HistoryEntry.result.ilike(like),
            )
        )
    total = query.count()
    entries = query.order_by(desc(HistoryEntry.timestamp)).limit(limit).all()
    return HistoryListResponse(
        entries=[HistoryEntryOut.model_validate(e) for e in entries], total=total,
    )


@router.delete("/history/{entry_id}")
def delete_history_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(HistoryEntry).filter(HistoryEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")
    db.delete(entry)
    db.commit()
    return {"status": "deleted", "id": entry_id}


@router.delete("/history")
def clear_history(db: Session = Depends(get_db)):
    count = db.query(HistoryEntry).delete()
    db.commit()
    return {"status": "cleared", "deleted": count}
