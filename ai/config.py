"""
Central configuration loaded from environment variables.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:8080"

    # AWS Bedrock (LLM generation). Model IDs are US cross-region inference
    # profiles, so inference stays in US regions. Uses the AWS credentials below.
    bedrock_region: str = "us-east-1"
    chat_model: str = "us.anthropic.claude-sonnet-4-6"
    rfp_draft_model: str = "us.anthropic.claude-sonnet-4-6"
    rfp_parse_model: str = "us.anthropic.claude-sonnet-4-6"
    fallback_model: str = "us.anthropic.claude-haiku-4-5-20251001-v1:0"

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
