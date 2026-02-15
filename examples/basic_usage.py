"""
Example usage of the Document Intelligence library.
"""

from doc_intelligence import DocumentProcessor

def main():
    """
    Demonstrate basic usage of the document processor.
    """
    # Initialize the processor
    processor = DocumentProcessor()
    
    print("Document Intelligence - Example Usage")
    print("=" * 50)
    
    # Example: Process a document (this would fail without an actual file)
    # Uncomment and modify the path to test with a real document
    # result = processor.process("path/to/your/document.pdf")
    # print(f"Processing result: {result}")
    
    print("\nNote: Replace the document path with an actual file to see results")


if __name__ == "__main__":
    main()
