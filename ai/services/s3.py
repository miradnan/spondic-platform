"""
AWS S3 file retrieval service.
"""

import logging
import tempfile

import boto3
from botocore.exceptions import ClientError

from config import settings

logger = logging.getLogger(__name__)


def _get_client():
    """Create a boto3 S3 client with configured credentials."""
    kwargs = {
        "region_name": settings.aws_region,
    }
    if settings.aws_access_key_id:
        kwargs["aws_access_key_id"] = settings.aws_access_key_id
    if settings.aws_secret_access_key:
        kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
    return boto3.client("s3", **kwargs)


def download_file(s3_key: str) -> str:
    """
    Download a file from S3 to a local temp path.

    Returns the local file path.
    """
    client = _get_client()
    suffix = ""
    if "." in s3_key:
        suffix = "." + s3_key.rsplit(".", 1)[-1]

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp_path = tmp.name
    tmp.close()

    try:
        logger.info("Downloading s3://%s/%s -> %s", settings.aws_bucket_name, s3_key, tmp_path)
        client.download_file(settings.aws_bucket_name, s3_key, tmp_path)
        return tmp_path
    except ClientError as exc:
        logger.error("S3 download failed for key=%s: %s", s3_key, exc)
        raise RuntimeError(f"Failed to download file from S3: {s3_key}") from exc


def get_file_content(s3_key: str) -> bytes:
    """Download a file from S3 and return its raw bytes."""
    client = _get_client()
    try:
        response = client.get_object(Bucket=settings.aws_bucket_name, Key=s3_key)
        return response["Body"].read()
    except ClientError as exc:
        logger.error("S3 get_object failed for key=%s: %s", s3_key, exc)
        raise RuntimeError(f"Failed to read file from S3: {s3_key}") from exc
