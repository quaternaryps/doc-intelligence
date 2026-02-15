"""
Tests for the DocumentProcessor class.
"""

import pytest
from pathlib import Path
from doc_intelligence.processor import DocumentProcessor


def test_processor_initialization():
    """Test that DocumentProcessor initializes correctly."""
    processor = DocumentProcessor()
    assert processor.config == {}


def test_processor_with_config():
    """Test DocumentProcessor with custom configuration."""
    config = {"option": "value"}
    processor = DocumentProcessor(config=config)
    assert processor.config == config


def test_process_nonexistent_file():
    """Test processing a file that doesn't exist."""
    processor = DocumentProcessor()
    with pytest.raises(FileNotFoundError):
        processor.process("nonexistent_file.pdf")
