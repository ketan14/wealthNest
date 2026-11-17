# WealthNest — Known Limitations & Operational Considerations

**Document:** Operational Boundaries & Known Usability Considerations  
**Audience:** End Users, Support Engineers, Technical Writers  
**Version:** 1.0.0  
**Status:** Live Repository Audit  
**Last Updated:** 2026-11-17  

---

## 1. Overview
This document outlines the current operational boundaries, partially implemented workflows, and user-facing limitations in the existing WealthNest application. It serves as an authoritative guide to prevent user confusion and identify areas slated for upcoming roadmap phases.

---

## 2. Documented Operational Limitations

### 2.1 Live Automated Broker Feeds
- **Current Behavior:** Investment holdings in equities and mutual funds are managed via manual entry or periodic **CAMS / KFintech CAS PDF statement imports**.
- **Limitation:** WealthNest does not currently maintain live WebSocket or direct API sync connections with Indian stockbrokers (such as Zerodha Kite Connect, Groww, or Upstox). Live stock tickers and NAVs require manual entry or fresh CAS statement re-import.
- **Roadmap Placement:** Direct broker OAuth sync is scheduled for a future release.

### 2.2 Recurring Rules Execution Engine
- **Current Behavior:** The **Recurring Rules** card on the Transactions page allows users to view and define monthly recurring rules (such as SIPs, monthly salaries, or EMI obligations).
- **Limitation:** In the current version, recurring rules serve as a visual planner and projection aid. They do not automatically execute unattended cron writes into the transactions ledger table without user confirmation.
- **Roadmap Placement:** Automated background recurring ledger posting is planned for Phase 19.

### 2.3 Mobile Native Packaging Shell
- **Current Behavior:** WealthNest operates as a fully responsive Web application (accessible via mobile web browsers on smartphones and tablets).
- **Limitation:** The dedicated Android native APK package (`in.wealthnest.app` wrapped via Capacitor) with biometric app lock and Android Keystore token persistence is in development (`Phase 18C`) and has not yet been published to the Google Play Store.
- **User Guidance:** Smartphone users can currently access all features seamlessly by visiting the application URL in mobile Chrome, Safari, or Brave.

### 2.4 Offline-First Synchronization
- **Current Behavior:** When running the Desktop version via Tauri 2, a local SQLite database (`wealthnest_v1.db`) provides local persistence.
- **Limitation:** WealthNest is currently a **cloud-backed online platform**. Bi-directional offline synchronization with conflict resolution (queuing offline mobile transactions and syncing later upon reconnection) is not yet active. Changes made without an active internet connection will not sync to other household members.
- **Roadmap Placement:** True offline-first sync with SQLCipher is planned for Phase 19.

### 2.5 Multi-Currency Conversion
- **Current Behavior:** WealthNest defaults to Indian Rupees (**INR / ₹**), with strict integer paise precision.
- **Limitation:** While currency codes (`USD`, `EUR`, `GBP`) exist in the domain model, live real-time foreign exchange rate conversion between disparate currencies in a single portfolio view is not dynamically polled. Non-INR assets should be recorded with their equivalent INR converted valuation.

### 2.6 Document Vault Virus Scanning
- **Current Behavior:** Uploaded documents (PDFs, images) are validated for file size (capped at 20 MiB) and verified using client-side binary magic-number header validation.
- **Limitation:** Backend cloud antivirus scanning (e.g. ClamAV daemon) is not currently operational on the storage bucket. Users should only upload trusted files from their own devices.

---

## 3. Items Requiring Product Owner Confirmation

| Item | Current Status in App | User Experience Impact | Product Confirmation Needed |
|---|---|---|---|
| **Support Mode Notifications** | Platform super-admins can initiate time-bounded 15-minute support sessions to diagnose issues. | User portfolio can be inspected in read-only mode during an active support session. | Confirm whether users should receive an automated email/SMS alert when a support session is initiated. |
| **Account Self-Deletion** | Users can sign out and remove family members. | A self-service "Delete Account & Purge Data" button is not present on the Profile Security tab. | Confirm data retention and deletion grace-period policy for account closures. |
| **Asset Archival vs Deletion** | Holdings and assets can be deleted from the database. | Deleting an asset removes historical records if not marked as sold. | Confirm whether a dedicated "Archive / Marked as Sold" lifecycle state should replace hard deletion in the UI. |
