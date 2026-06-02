<div align="center">

  <!-- Using the mark (icon) instead of the full logo for a cleaner vertical stack -->
  <img src="dashboard/receiptpulse-mark.svg" alt="ReceiptPulse" width="150" />

  <h1>ReceiptPulse</h1>
  
  <p><strong>The Enterprise-Grade Serverless Receipt Intelligence Platform.</strong></p>

  <p>
    <a href="https://github.com/agarwalujala3-lang/ReceiptPulse/actions/workflows/validate.yml">
      <img src="https://github.com/agarwalujala3-lang/ReceiptPulse/actions/workflows/validate.yml/badge.svg" alt="Build Status">
    </a>
    <img src="https://img.shields.io/badge/Architecture-Serverless-blue" alt="Architecture">
    <img src="https://img.shields.io/badge/Stack-AWS+JS-ff69b4" alt="Stack">
    <img src="https://img.shields.io/badge/License-MIT-success" alt="License">
  </p>

</div>

<br />
<br />

---

<br />

## 🚀 The Product Experience
ReceiptPulse isn't just an OCR script—it's a **secure, multi-tenant workspace**. Each user gets a private environment to digitize financial records.

<br />

| Feature | Production Implementation |
| :--- | :--- |
| **Intelligent OCR** | Amazon Textract `AnalyzeExpense` (Vendor, Line-items, Data) |
| **Identity** | Cognito-backed User Pools with direct sign-in flow |
| **Logic** | Event-driven Lambda pipeline with Auto-labels & Deduplication |
| **UI/UX** | Glassmorphism-inspired dashboard with interactive data trends |

<br />
<br />

---

<br />

## 📐 Architectural Design
<p align="center">
  <img src="dashboard/receiptpulse-github-preview.svg?v=20260408a" alt="Architecture Diagram" width="800" />
</p>

<br />

### The Processing Flow
1. **Ingestion:** Signed-in users get a secure S3 upload session.
2. **AI Processing:** Asynchronous Lambda triggers initiate OCR extraction.
3. **Integrity Layer:** Hashed signature validation intercepts duplicate submissions.
4. **Sync:** DynamoDB serves structured records to the front-end via HTTP API.

<br />
<br />

---

<br />

## 🛠️ Technical Specifications

<div align="center">

| Category | Technology |
| :--- | :--- |
| **Backend** | Python 3.12 (AWS Lambda) |
| **IaC** | AWS SAM (Serverless Application Model) |
| **AI/ML** | Amazon Textract |
| **Frontend** | Vanilla JavaScript & CSS |
| **Hosting** | AWS Amplify (Static Web Hosting) |

</div>

<br />
<br />

---

<br />

## 📊 Analytics & Insights
ReceiptPulse provides a real-time financial control board:

<details>
  <summary><b>Click to expand: Key Performance Metrics</b></summary>
  <br />
  
  * **Spend Breakdown:** Auto-categorized expenses based on merchant-item patterns.
  * **Processing Throughput:** Live monitoring of ingestion and extraction cycles.
  * **Operational Quality:** Confidence-scoring metrics for every single document processed.
</details>

<br />
<br />

---

<br />

## ⚙️ Deployment

### Infrastructure
```bash
sam build
sam deploy --guided
