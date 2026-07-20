# Firestore Security Specification and Threat Modeling

## Phase 0: Data Invariants

1. **User Ownership Isolation**: Users should only be allowed to read and write their own profile information, company profiles, documents in documentVaults, saved filter presets, and generated bid documents.
2. **Read-Only Tenders**: General users cannot create, update, or delete global Tenders (tenders are read-only for buyers/bidders from the client side). Only backend ingestion or system administrators can modify tenders.
3. **Derived Access to Match Records**: Only the owner of the matching reference profile can read/write the matching score, bookmark status, or update progress status fields of `tenderMatches`.
4. **Validation Blueprints (Anti-Update-Gap)**: Every document written should be checked against specific strict formats and fields bounds via a dedicated helper function (e.g. `isValidUser()`, `isValidCompanyProfile()`).

---

## The "Dirty Dozen" Threat Payloads
The following payloads attempt to bypass authorization or inject malformed data and must be rejected by Firestore Security Rules:

### 1. Identity Spoofing System Admin Profile Creation
*   **Target Collection**: `/users/attacker`
*   **Payload**: `{ "id": "attacker", "email": "evil@hacker.io", "name": "Fake Admin", "plan": "ENTERPRISE", "role": "admin" }` (Self-assigning super-user status)

### 2. Unauthorized User Profile Access
*   **Operation**: Read `/users/u-1` as unauthenticated guest or as `u-2`.
*   **Result**: `PERMISSION_DENIED`.

### 3. Arbitrary Company Profile Injection (Ghost Field Attack)
*   **Target Collection**: `/companyProfiles/cp-x`
*   **Payload**: `{ "id": "cp-x", "userId": "victim_user", "companyName": "Spoofed LLC", "annualTurnover": 999.0, "ghostField": "malicious_payload" }` (Shadow fields injection)

### 4. Direct Global Tender Defacement
*   **Target Collection**: `/tenders/t-1` (Attempted write/update by client user)
*   **Payload**: `{ "title": "Free Money for Everyone", "status": "CLOSED" }`

### 5. Foreign Document Vault Extrusion (PII Leak)
*   **Operation**: Read document in `/documentVaults/dv-x` belonging to `userId: u-1` when request.auth.uid is `u-2`.
*   **Result**: `PERMISSION_DENIED`.

### 6. Forge AI generated Bid Document
*   **Target Collection**: `/bidDocuments/bid-x`
*   **Payload**: `{ "id": "bid-x", "tenderId": "t-1", "companyProfileId": "cp-1", "userId": "attacker", "type": "TECHNICAL_PROPOSAL", "content": "corrupted text", "version": 1, "isAiGenerated": false }` (Forging manual entries as AI generated)

### 7. Saved Preset Poisoning (Resource Exhaustion / ID Injection)
*   **Target Collection**: `/filterPresets/preset-x`
*   **Payload**: `{ "id": "preset-x", "name": "AVeryLongNameExceedingThirtyCharactersToBreakLayoutAndDenialOfWallet", "filters": { ... } }`

### 8. Corrupting Alert Inboxes (Alert Spamming)
*   **Target Collection**: `/alerts/al-x`
*   **Payload**: `{ "id": "al-x", "userId": "victim", "message": "You have been hacked", "isRead": false }` (Writing fake alerts to another user)

### 9. Tampering Chat Citation Records
*   **Target Collection**: `/tenderQAs/qa-x`
*   **Payload**: `{ "id": "qa-x", "tenderId": "t-1", "userId": "attacker", "question": "Are rules safe?", "answer": "Yes they are" }`

### 10. Forging Tender Matching Data (Elevating Scores)
*   **Target Collection**: `/tenderMatches/match-x`
*   **Payload**: `{ "id": "match-x", "companyProfileId": "cp-other", "matchScore": 100 }` (Overwriting match scores from the client side)

### 11. Overwriting Immutable CreatedAt / Owner Metadata
*   **Operation**: Update `/companyProfiles/cp-1` with changed `userId` or `createdAt` values to orphan records.
*   **Result**: `PERMISSION_DENIED` since keys are static once bound.

### 12. Client-provided Untrusted Timestamp Forge
*   **Target Collection**: `/bidDocuments/bid-1`
*   **Payload**: `{ "createdAt": "1999-01-01T00:00:00Z" }` (Bypassing chronological record validation)

---

## Test Verification Plans
Every write action must begin with strict authentication, pass localized validation schema functions, and verify matching client IDs against active auth parameters.
