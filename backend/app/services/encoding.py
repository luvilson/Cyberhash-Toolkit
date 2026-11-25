"""
Reversible encoding/decoding utilities.

Important distinction surfaced throughout the app: these are ENCODINGS,
not cryptographic hashes. They are fully reversible and provide no
security guarantee whatsoever.
"""
import base64
import codecs
import urllib.parse


class EncodingError(ValueError):
    pass


def encode(text: str, encoding: str) -> str:
    try:
        if encoding == "Base64":
            return base64.b64encode(text.encode("utf-8")).decode("ascii")
        if encoding == "Hex":
            return text.encode("utf-8").hex()
        if encoding == "URL Encoding":
            return urllib.parse.quote(text, safe="")
        if encoding == "ROT13":
            return codecs.encode(text, "rot13")
    except Exception as exc:  # noqa: BLE001
        raise EncodingError(f"Could not encode input as {encoding}: {exc}") from exc
    raise EncodingError(f"Unsupported encoding: {encoding}")


def decode(text: str, encoding: str) -> str:
    try:
        if encoding == "Base64":
            padded = text.strip()
            padded += "=" * (-len(padded) % 4)
            return base64.b64decode(padded).decode("utf-8", errors="replace")
        if encoding == "Hex":
            cleaned = text.strip().replace(" ", "")
            return bytes.fromhex(cleaned).decode("utf-8", errors="replace")
        if encoding == "URL Encoding":
            return urllib.parse.unquote(text)
        if encoding == "ROT13":
            return codecs.encode(text, "rot13")  # ROT13 is self-inverse
    except Exception as exc:  # noqa: BLE001
        raise EncodingError(f"Could not decode input as {encoding}: {exc}") from exc
    raise EncodingError(f"Unsupported encoding: {encoding}")
