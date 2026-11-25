"""
Bounded, educational dictionary and brute-force demonstrations.

Everything here is intentionally capped:
  - wordlists are small, curated, and built-in (no external credential dumps)
  - the wordlist attack demo caps the number of candidates it will try
  - the brute-force demo caps both max candidate length and total search space

This module demonstrates *how* dictionary and brute-force attacks work
conceptually, for defensive/educational purposes — it is not a general
cracking tool.
"""
import itertools
import time
from typing import Dict, List, Optional, Tuple

from app.services.hashing import hash_text

# --- Built-in curated wordlists (deliberately small and educational) ---

COMMON_PASSWORDS: List[str] = [
    "123", "123456", "password", "123456789", "12345678", "12345", "1234567",
    "qwerty", "abc123", "111111", "123123", "admin", "letmein", "welcome",
    "monkey", "login", "princess", "solo", "iloveyou", "dragon", "master",
    "sunshine", "ashley", "football", "shadow", "michael", "jennifer",
    "computer", "test", "trustno1", "batman", "starwars", "freedom",
    "whatever", "hello", "charlie", "donald", "password1", "qwerty123",
    "1q2w3e4r", "zaq12wsx", "passw0rd", "superman", "michelle", "jessica",
    "hunter", "ranger", "buster", "george", "harley", "hockey", "killer",
    "jordan", "cameron", "tigger", "banana", "666666", "121212", "000000",
    "1234", "12345678910", "asdfghjkl", "changeme", "guest", "root",
    "toor", "user", "default", "temp123", "welcome1", "letmein1",
    "P@ssw0rd", "P@ssword1", "abcd1234", "1qaz2wsx", "qazwsx", "q1w2e3r4",
]

KEYBOARD_PATTERNS: List[str] = [
    "qwerty", "asdfgh", "zxcvbn", "qazwsx", "1qaz2wsx", "qwertyuiop",
    "asdfghjkl", "1q2w3e4r", "q1w2e3r4t5", "qweasd", "poiuyt",
]

DEFAULT_CREDENTIALS: List[str] = [
    "admin", "administrator", "root", "toor", "guest", "user", "default",
    "password", "changeme", "cisco", "ubnt", "pass", "1234", "12345",
    "admin123", "admin1234", "router", "wifi", "support", "service",
    "manager", "oracle", "postgres", "mysql", "sa", "raspberry", "pi",
]

NUMERIC_PINS: List[str] = (
    [f"{n:04d}" for n in range(10000)]
    + ["123456", "000000", "111111", "121212", "654321", "112233", "666666"]
    + [str(y) for y in range(1970, 2031)]
)

STANDARD_USERNAMES: List[str] = [
    "admin", "administrator", "root", "user", "guest", "test", "operator",
    "manager", "support", "service", "backup", "info", "sysadmin", "webmaster",
    "postmaster", "ftp", "www", "oracle", "postgres", "ubuntu", "pi", "demo",
]

CTF_KEYWORDS: List[str] = [
    "flag", "ctf", "picoctf", "hackme", "hackthebox", "tryhackme", "secret",
    "letmein", "opensesame", "s3cr3t", "h4x0r", "pwned", "root", "toor",
    "cyber", "security", "infosec", "exploit", "payload", "shell",
]

YEARS_1990_2030: List[str] = [str(y) for y in range(1990, 2031)]

_MASTER_COMBINED: List[str] = list(dict.fromkeys(
    COMMON_PASSWORDS + KEYBOARD_PATTERNS + DEFAULT_CREDENTIALS
    + STANDARD_USERNAMES + CTF_KEYWORDS + NUMERIC_PINS
))

PRESET_WORDLISTS: Dict[str, List[str]] = {
    "common-passwords": COMMON_PASSWORDS,
    "default-credentials": DEFAULT_CREDENTIALS,
    "numeric-pins": NUMERIC_PINS,
    "standard-usernames": STANDARD_USERNAMES,
    "ctf-keywords": CTF_KEYWORDS,
    "keyboard-patterns": KEYBOARD_PATTERNS,
    "years-1990-2030": YEARS_1990_2030,
    "master-combined": _MASTER_COMBINED,
}

DECODE_ALGORITHMS = ["MD5", "SHA1", "SHA256", "SHA512"]

MAX_WORDLIST_CANDIDATES = 20000
MAX_BRUTEFORCE_SEARCH_SPACE = 2_000_000  # hard safety cap on total candidates tried


# ---------- Hash Decoder (dictionary lookup, algorithm unknown) ----------

def decode_hash(target_hash: str) -> Tuple[bool, Optional[str], Optional[str], int]:
    """
    Try to find a plaintext for `target_hash` by hashing every word in the
    built-in common-passwords list with each of DECODE_ALGORITHMS.
    Returns (found, plaintext, algorithm_guess, entries_checked).
    """
    target = target_hash.strip().lower()
    checked = 0
    for word in COMMON_PASSWORDS:
        for algo in DECODE_ALGORITHMS:
            checked += 1
            if hash_text(word, algo).lower() == target:
                return True, word, algo, checked
    return False, None, None, checked


# ---------- Wordlist Attack demo (algorithm specified, bounded candidates) ----------

def wordlist_attack(
    target_hash: str,
    algorithm: str,
    wordlist_name: Optional[str] = "common-passwords",
    custom_candidates: Optional[List[str]] = None,
) -> Dict:
    target = target_hash.strip().lower()

    if custom_candidates:
        candidates = custom_candidates
    else:
        candidates = PRESET_WORDLISTS.get(wordlist_name or "common-passwords", COMMON_PASSWORDS)

    candidates = candidates[:MAX_WORDLIST_CANDIDATES]
    total_candidates = len(candidates)

    start = time.perf_counter()
    attempts = 0
    matched_candidate = None
    for candidate in candidates:
        attempts += 1
        if hash_text(candidate, algorithm).lower() == target:
            matched_candidate = candidate
            break
    elapsed_ms = (time.perf_counter() - start) * 1000

    return {
        "target_hash": target_hash.strip(),
        "algorithm": algorithm,
        "matched": matched_candidate is not None,
        "candidate": matched_candidate,
        "attempts": attempts,
        "total_candidates": total_candidates,
        "time_ms": round(elapsed_ms, 3),
        "status": "match" if matched_candidate is not None else "no_match",
    }


# ---------- Brute-Force demo (tightly bounded) ----------

def _theoretical_search_space(charset_size: int, max_length: int) -> int:
    return sum(charset_size ** length for length in range(1, max_length + 1))


def brute_force_demo(target_hash: str, algorithm: str, max_length: int, charset: str) -> Dict:
    target = target_hash.strip().lower()
    charset = "".join(dict.fromkeys(charset))  # de-duplicate, preserve order
    charset_size = len(charset)

    theoretical_space = _theoretical_search_space(charset_size, max_length)
    capped = theoretical_space > MAX_BRUTEFORCE_SEARCH_SPACE

    start = time.perf_counter()
    tested = 0
    matched_candidate = None

    outer_break = False
    for length in range(1, max_length + 1):
        if outer_break:
            break
        for combo in itertools.product(charset, repeat=length):
            tested += 1
            candidate = "".join(combo)
            if hash_text(candidate, algorithm).lower() == target:
                matched_candidate = candidate
                outer_break = True
                break
            if tested >= MAX_BRUTEFORCE_SEARCH_SPACE:
                outer_break = True
                break
    elapsed_ms = (time.perf_counter() - start) * 1000

    return {
        "target_hash": target_hash.strip(),
        "algorithm": algorithm,
        "matched": matched_candidate is not None,
        "candidate": matched_candidate,
        "candidates_tested": tested,
        "search_space": theoretical_space if not capped else MAX_BRUTEFORCE_SEARCH_SPACE,
        "time_ms": round(elapsed_ms, 3),
        "status": "match" if matched_candidate is not None else "no_match",
    }
