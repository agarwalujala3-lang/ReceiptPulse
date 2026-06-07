import unittest
import sys
import os
import types

LAMBDA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "lambda"))
sys.path.insert(0, LAMBDA_DIR)


def install_boto3_stub():
    """Allow pure helper tests to import the Lambda module without AWS SDK deps."""
    if "boto3" in sys.modules:
        return

    boto3_stub = types.ModuleType("boto3")
    boto3_stub.client = lambda *args, **kwargs: object()
    boto3_stub.resource = lambda *args, **kwargs: object()

    dynamodb_stub = types.ModuleType("boto3.dynamodb")
    conditions_stub = types.ModuleType("boto3.dynamodb.conditions")

    class Key:
        def __init__(self, *args, **kwargs):
            pass

    conditions_stub.Key = Key
    sys.modules["boto3"] = boto3_stub
    sys.modules["boto3.dynamodb"] = dynamodb_stub
    sys.modules["boto3.dynamodb.conditions"] = conditions_stub


install_boto3_stub()

from lambda_function import normalize_vendor_token


class TestReceiptProcessing(unittest.TestCase):

    def test_vendor_token_normalization(self):
        self.assertEqual(normalize_vendor_token("Amazon Inc."), "amazoninc")
        self.assertEqual(normalize_vendor_token("  Starbucks  "), "starbucks")
        self.assertEqual(normalize_vendor_token("Uber 123!"), "uber123")


if __name__ == '__main__':
    unittest.main()
