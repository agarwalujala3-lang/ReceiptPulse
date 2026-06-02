<div align="center">
  <img src="dashboard/receiptpulse-mark.svg" alt="ReceiptPulse" width="150" />
  
  <h1 style="color: #63d0ff;">ReceiptPulse</h1>
  <p style="font-size: 1.2rem; color: #8899aa;">
    <i>The Enterprise-Grade Serverless Receipt Intelligence Platform</i>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Status-Cloud%20Optimized-green?style=flat-square" alt="Status">
    <img src="https://img.shields.io/badge/Architecture-EventDriven-blue?style=flat-square" alt="Architecture">
    <img src="https://img.shields.io/badge/License-MIT-success?style=flat-square" alt="License">
  </p>
</div>

<br />

---

<h2 style="color: #ff8a5b;">🚀 The Product Experience</h2>
ReceiptPulse is a <strong>secure, multi-tenant workspace</strong> for digitizing and analyzing financial records.

| Feature | Production Implementation |
| :--- | :--- |
| <span style="color: #63d0ff;">●</span> <strong>Intelligent OCR</strong> | Amazon Textract AnalyzeExpense |
| <span style="color: #63d0ff;">●</span> <strong>Identity</strong> | Cognito-backed User Pools |
| <span style="color: #63d0ff;">●</span> <strong>Logic</strong> | Event-driven Lambda & Auto-labels |
| <span style="color: #63d0ff;">●</span> <strong>UI/UX</strong> | Glassmorphism Dashboard |

---

<h2 style="color: #63d0ff;">📐 Architectural Design</h2>
<p align="center">
  <img src="dashboard/receiptpulse-github-preview.svg?v=20260408a" alt="Architecture Diagram" width="700" />
</p>

<h3 style="color: #ff8a5b;">The Processing Flow</h3>
<ol>
  <li><strong>Ingestion:</strong> Secure S3 upload session via API Gateway.</li>
  <li><strong>AI Processing:</strong> Asynchronous Lambda triggers initiate OCR extraction.</li>
  <li><strong>Integrity Layer:</strong> SHA-256 hashed signature validation prevents duplicates.</li>
  <li><strong>Sync:</strong> Real-time HTTP API updates to the frontend.</li>
</ol>

---

<h2 style="color: #63d0ff;">📊 Analytics & Insights</h2>
<p>ReceiptPulse provides a real-time financial control board for operational teams.</p>

<details>
  <summary style="cursor: pointer; color: #ff8a5b;"><b>Click to view Core Metrics</b></summary>
  <ul>
    <li><b>Spend Breakdown:</b> Auto-categorized patterns.</li>
    <li><b>Throughput:</b> Live monitoring of extraction cycles.</li>
    <li><b>Quality Control:</b> AI confidence-scoring for every record.</li>
  </ul>
</details>

---

<div align="center">
  <p><i>Built by <a href="https://github.com/agarwalujala3-lang">Ujala Agarwal</a> • MIT Licensed</i></p>
</div>
