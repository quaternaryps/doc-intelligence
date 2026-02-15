# Contributing to Document Intelligence

Thank you for your interest in contributing to the Document Intelligence project!

## How to Contribute

### Reporting Issues

- Check if the issue already exists in the issue tracker
- Provide a clear description of the problem
- Include steps to reproduce the issue
- Specify your environment (OS, Python version, etc.)

### Submitting Pull Requests

1. Fork the repository
2. Create a new branch for your feature (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Write or update tests as needed
5. Ensure all tests pass
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to your branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Standards

- Follow PEP 8 style guidelines for Python code
- Write clear, descriptive commit messages
- Add docstrings to all functions and classes
- Ensure code is well-tested
- Keep functions focused and modular

### Testing

- Write unit tests for new functionality
- Ensure all tests pass before submitting PR
- Aim for high test coverage

### Documentation

- Update README.md if adding new features
- Add docstrings to new functions and classes
- Update relevant documentation in the `docs/` directory

## Development Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install development dependencies
pip install -r requirements-dev.txt

# Run tests
pytest

# Run linting
flake8 src/ tests/
```

## Questions?

Feel free to open an issue for any questions or clarifications.
