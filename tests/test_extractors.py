"""
Tests for extractor modules.
"""

from doc_intelligence.extractors import TextExtractor, EntityExtractor


def test_text_extractor_initialization():
    """Test TextExtractor initializes correctly."""
    extractor = TextExtractor()
    assert extractor is not None


def test_entity_extractor_initialization():
    """Test EntityExtractor initializes correctly."""
    extractor = EntityExtractor()
    assert extractor is not None


def test_entity_extractor_returns_list():
    """Test EntityExtractor returns a list."""
    extractor = EntityExtractor()
    result = extractor.extract("Sample text")
    assert isinstance(result, list)
