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

    # Weaviate (vector store)
    weaviate_url: str = "http://localhost:8080"

    # AWS S3
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "ap-south-1"
    aws_bucket_name: str = "spondicbucket"

    class Config:
        env_file = ".env"


settings = Settings()
