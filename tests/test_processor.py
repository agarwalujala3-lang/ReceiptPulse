import unittest
import sys
import os

# Ensure the root directory is in the system path so it can find the 'lambda' folder
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from lambda_function import normalize_vendor_token

class TestReceiptProcessing(unittest.TestCase):
    
    def test_vendor_token_normalization(self):
        # Based on your current function: re.sub(r"[^a-z0-9]+", "", str(token or "").lower())
        # "Amazon Inc." -> "amazoninc"
        self.assertEqual(normalize_vendor_token("Amazon Inc."), "amazoninc")
        
        # "  Starbucks  " -> "starbucks"
        self.assertEqual(normalize_vendor_token("  Starbucks  "), "starbucks")
        
        # Numbers and symbols should be stripped or joined
        self.assertEqual(normalize_vendor_token("Uber 123!"), "uber123")

if __name__ == '__main__':
    unittest.main()