#!/usr/bin/env python3
"""
Database initialization script for Soonish.
Creates tables and sample data for testing.
"""
import sys
import os

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), 'src'))

from database import init_db
from config import settings

def main():
    """Initialize the database."""
    print("Initializing Soonish database...")
    print(f"Using Temporal URL: {settings.temporal_url}")
    
    try:
        init_db()
        print("Database initialized successfully!")
        print("Sample user and integration created for testing.")
    except Exception as e:
        print(f"Error initializing database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
