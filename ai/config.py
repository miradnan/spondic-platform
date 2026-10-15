"""
Central configuration loaded from environment variables.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:8080"

    # Groq (LLM generation)
    groq_api_key: str = ""
    chat_model: str = "llama-3.3-70b-versatile"
    rfp_draft_model: str = "llama-3.3-70b-versatile"
    rfp_parse_model: str = "llama-3.3-70b-versatile"

    # Qdrant (vector store). The API key is a collection-scoped JWT in production.
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    qdrant_collection: str = "spondic_chunks"

    # AWS S3
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "ap-south-1"
    aws_bucket_name: str = "spondicbucket"

    class Config:
        env_file = ".env"


settings = Settings()
