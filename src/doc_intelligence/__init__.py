"""
Document Intelligence Package

A comprehensive document processing and intelligence extraction platform.
"""

__version__ = "0.1.0"
__author__ = "quaternaryps"

from .processor import DocumentProcessor
from .extractors import TextExtractor, EntityExtractor
from .classifiers import DocumentClassifier

__all__ = [
    "DocumentProcessor",
    "TextExtractor",
    "EntityExtractor",
    "DocumentClassifier",
]
