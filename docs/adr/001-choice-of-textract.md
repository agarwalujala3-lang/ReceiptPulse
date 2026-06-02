ADR 001: Selection of Amazon Textract for Receipt Intelligence

Context

We needed a reliable OCR pipeline to extract financial line-item data from unstructured receipts.

Decision

We chose Amazon Textract (AnalyzeExpense API) over open-source alternatives like Tesseract or custom OpenCV models.

Consequences

Pros: managed service reliability, built-in support for document structures (tables, key-value pairs), significantly lower maintenance overhead.

Cons: Dependency on AWS proprietary API pricing.

Verdict: For an enterprise-grade prototype, we prioritize managed services to ensure scalability and accuracy over self-managed compute costs.