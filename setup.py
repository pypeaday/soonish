from setuptools import setup, find_packages

setup(
    name="soonish",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "fastapi",
        "uvicorn",
        "sqlalchemy",
        "aiosqlite",
        "python-multipart",
        "python-dotenv",
        "httpx",
        "pydantic",
        "pydantic-settings",
    ],
    python_requires=">=3.12",
)
