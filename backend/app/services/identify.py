"""
Heuristic hash identification.

This is deliberately NOT a cryptographic proof of algorithm — a hex string
of a given length is, by definition, ambiguous whenever more than one
algorithm shares that digest size. The service reports a confidence score
and lists every plausible candidate rather than asserting certainty.
"""
import re
from dataclasses import dataclass, field
from typing import List

HEX_RE = re.compile(r"^[0-9a-fA-F]+$")
BASE64_RE = re.compile(r"^[A-Za-z0-9+/]+={0,2}$")

# Hex digest length (in characters) -> plausible algorithms sharing that length.
# Ordered so the most statistically common algorithm at that length is first.
LENGTH_CANDIDATES = {
    32:  ["MD5", "NTLM", "LM"],
    40:  ["SHA1", "RIPEMD160"],
    56:  ["SHA224"],
    64:  ["SHA256", "SHA3-256", "BLAKE2s"],
    96:  ["SHA384"],
    128: ["SHA512", "SHA3-512", "Whirlpool", "BLAKE2"],
}


@dataclass
class IdentificationResult:
    algorithm: str
    confidence: int
    length: int
    charset: str
    possible_algorithms: List[str]
    reasoning: List[str] = field(default_factory=list)
    warning: str = None


def identify_hash(raw: str) -> IdentificationResult:
    value = raw.strip()
    length = len(value)
    reasoning: List[str] = []

    # --- Base64 check first: only worth flagging if it is NOT also valid hex,
    # since a pure hex string technically satisfies the base64 alphabet too. ---
    is_hex = bool(HEX_RE.match(value)) and length > 0
    is_base64_shape = bool(BASE64_RE.match(value)) and length % 4 == 0 and length > 0

    if not is_hex and is_base64_shape:
        reasoning.append(f"Input length is {length} characters and is a multiple of 4.")
        reasoning.append("Character set includes letters, digits, and possibly '+', '/' or '=' padding — consistent with Base64.")
        reasoning.append("Base64 is an encoding, not a hash — the underlying digest length cannot be inferred without decoding.")
        return IdentificationResult(
            algorithm="Base64",
            confidence=70,
            length=length,
            charset="Base64 (A-Z, a-z, 0-9, +, /, = padding)",
            possible_algorithms=["Base64"],
            reasoning=reasoning,
            warning="This looks like a Base64-encoded value rather than a raw hex digest.",
        )

    if not is_hex:
        reasoning.append(f"Input length is {length} characters.")
        reasoning.append("Character set does not match hexadecimal or standard Base64.")
        return IdentificationResult(
            algorithm="Unknown",
            confidence=0,
            length=length,
            charset="Non-standard / mixed",
            possible_algorithms=["Unknown"],
            reasoning=reasoning,
            warning="Could not match this input to a known hash format.",
        )

    # --- Hex path ---
    has_upper = any(c.isalpha() and c.isupper() for c in value)
    has_lower = any(c.isalpha() and c.islower() for c in value)
    case_note = "mixed case" if (has_upper and has_lower) else ("uppercase" if has_upper else "lowercase")
    charset_desc = f"Hexadecimal ({case_note})"

    candidates = LENGTH_CANDIDATES.get(length)

    if not candidates:
        reasoning.append(f"Input is valid hexadecimal, {length} characters long.")
        reasoning.append("This length does not match a common supported digest size.")
        return IdentificationResult(
            algorithm="Unknown",
            confidence=10,
            length=length,
            charset=charset_desc,
            possible_algorithms=["Unknown"],
            reasoning=reasoning,
            warning="Valid hex, but no known algorithm at this exact length is supported.",
        )

    reasoning.append(f"Input is valid hexadecimal, {length} characters long ({length * 4}-bit digest).")
    reasoning.append(f"Character case: {case_note}.")

    primary = candidates[0]
    n = len(candidates)

    if n == 1:
        confidence = 92
        reasoning.append(f"{length} hex characters uniquely matches {primary} among supported algorithms.")
        warning = None
    else:
        # Confidence drops as more algorithms share the same length/format.
        confidence = max(35, 88 - (n - 1) * 18)
        reasoning.append(
            f"{length} hex characters is shared by {n} supported formats: {', '.join(candidates)}."
        )
        if length == 32 and has_upper and not has_lower:
            reasoning.append("All-uppercase formatting is common for LM hashes, which raises its likelihood slightly.")
        warning = (
            f"Multiple algorithms share this digest length ({', '.join(candidates)}). "
            "Confidence reflects that ambiguity — treat the top result as a best guess, not a certainty."
        )

    return IdentificationResult(
        algorithm=primary,
        confidence=confidence,
        length=length,
        charset=charset_desc,
        possible_algorithms=candidates,
        reasoning=reasoning,
        warning=warning,
    )


def compare_hashes(first: str, second: str, case_sensitive: bool = False) -> bool:
    a, b = first.strip(), second.strip()
    if not case_sensitive:
        a, b = a.lower(), b.lower()
    return a == b
