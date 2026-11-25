"""
Core hashing service.

Wraps Python's standard `hashlib` to provide a uniform interface across
all ten supported algorithms, for both text and file (byte-stream) input.
"""
import hashlib
from typing import Callable, Dict, List, Tuple

ALGORITHMS: Dict[str, Callable] = {
    "MD5": hashlib.md5,
    "SHA1": hashlib.sha1,
    "SHA224": hashlib.sha224,
    "SHA256": hashlib.sha256,
    "SHA384": hashlib.sha384,
    "SHA512": hashlib.sha512,
    "SHA3-256": hashlib.sha3_256,
    "SHA3-512": hashlib.sha3_512,
    "BLAKE2b": hashlib.blake2b,
    "BLAKE2s": hashlib.blake2s,
}

ALGORITHM_ORDER: List[str] = list(ALGORITHMS.keys())

# 50 MB, matching the documented maximum upload size
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
FILE_CHUNK_SIZE = 1024 * 1024  # 1 MB read chunks, to keep memory bounded


def hash_text(text: str, algorithm: str) -> str:
    """Hash a UTF-8 string with the given algorithm, returning a hex digest."""
    if algorithm not in ALGORITHMS:
        raise ValueError(f"Unsupported algorithm: {algorithm}")
    hasher = ALGORITHMS[algorithm]()
    hasher.update(text.encode("utf-8"))
    return hasher.hexdigest()


def hash_text_all(text: str) -> List[Tuple[str, str]]:
    """Hash the same text with every supported algorithm."""
    return [(algo, hash_text(text, algo)) for algo in ALGORITHM_ORDER]


def hash_file_bytes(file_obj, algorithm: str) -> Tuple[str, int]:
    """
    Stream-hash a file-like object with the given algorithm.
    Returns (hex_digest, total_bytes_read). Raises ValueError if the file
    exceeds MAX_FILE_SIZE_BYTES.
    """
    if algorithm not in ALGORITHMS:
        raise ValueError(f"Unsupported algorithm: {algorithm}")
    hasher = ALGORITHMS[algorithm]()
    total = 0
    while True:
        chunk = file_obj.read(FILE_CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_FILE_SIZE_BYTES:
            raise ValueError("File exceeds the 50 MB maximum size")
        hasher.update(chunk)
    return hasher.hexdigest(), total


def hash_file_bytes_all(file_obj) -> Tuple[List[Tuple[str, str]], int]:
    """
    Hash a file with every supported algorithm in a single pass.
    Reads the file once into memory (bounded by MAX_FILE_SIZE_BYTES) since
    hashlib hashers cannot share a single read pass across algorithms
    without buffering the chunks themselves.
    """
    hashers = {name: cls() for name, cls in ALGORITHMS.items()}
    total = 0
    while True:
        chunk = file_obj.read(FILE_CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_FILE_SIZE_BYTES:
            raise ValueError("File exceeds the 50 MB maximum size")
        for h in hashers.values():
            h.update(chunk)
    results = [(name, h.hexdigest()) for name, h in hashers.items()]
    return results, total
