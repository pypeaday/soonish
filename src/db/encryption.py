from cryptography.fernet import Fernet
from src.config import get_settings

_cipher_suite: Fernet | None = None


def get_cipher() -> Fernet:
    """Get or create the Fernet cipher suite"""
    global _cipher_suite
    if _cipher_suite is None:
        settings = get_settings()
        key_bytes = settings.encryption_key.encode()
        _cipher_suite = Fernet(key_bytes)
    return _cipher_suite


def encrypt_field(plaintext: str) -> bytes:
    """Encrypt a string field and return bytes"""
    cipher = get_cipher()
    return cipher.encrypt(plaintext.encode())


def decrypt_field(ciphertext: bytes) -> str:
    """Decrypt a bytes field and return string"""
    cipher = get_cipher()
    return cipher.decrypt(ciphertext).decode()
