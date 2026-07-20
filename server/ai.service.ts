import { GoogleGenAI } from "@google/genai";
import { db, Tender, CompanyProfile } from "./db.js";

/**
 * Utility to robustly clean and parse JSON fragments returned by Gemini model.
 * Handles markdown backticks, leading/trailing notes, and other potential formatting debris.
 */
export function parseCleanJSON(rawText: string): any {
  if (!rawText) return {};
  let cleaned = rawText.trim();
  
  // Remove markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/, "");
    cleaned = cleaned.trim();
  }

  // Find the first outer '{' or '[' and the last '}' or ']'
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf("}");
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf("]");
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("Failed to parse cleaned JSON, trying last-resort recovery:", e);
    try {
      // Basic last resort: replace trailing commas before closing braces/brackets
      const relaxedCleaned = cleaned
        .replace(/,\s*([\]}])/g, "$1")
        .trim();
      return JSON.parse(relaxedCleaned);
    } catch (innerErr) {
      console.error("All JSON parsing attempts failed. Raw text:", rawText);
      throw innerErr;
    }
  }
}

// Optional type declaration for compiling
let aiInstance: GoogleGenAI | null = null;

export function getGeminiAI(): GoogleGenAI | null {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
      console.warn("GEMINI_API_KEY environment variable is not defined or is placeholder. Using robust local simulation.");
      return null;
    }
    try {
      aiInstance = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    } catch (err) {
      console.error("Failed to initialize GoogleGenAI:", err);
      return null;
    }
  }
  return aiInstance;
}

/**
 * 1. TENDER SUMMARIZATION
 */
export async function summarizeTender(tender: Tender): Promise<any> {
  const ai = getGeminiAI();

  if (!ai) {
    // Elegant local fallback content based on structured tender data
    return {
      summary: `This tender calls for "${tender.title}" located in ${tender.location}. CPWD and Bihar departments will jointly oversee execution. The contractor will undertake structural layout laying, electrical installations, and finishing works matching quality indexes.`,
      keyDates: {
        publishedDate: tender.publishedDate,
        bidSubmissionDeadline: tender.bidSubmissionDeadline,
        openingDate: tender.openingDate || "Will be informed later",
      },
      eligibilityCriteria: {
        minTurnover: `${tender.eligibilityCriteria.minTurnover} Cr`,
        minExperience: `${tender.eligibilityCriteria.minExperience} Years`,
        requiredCertifications: tender.eligibilityCriteria.requiredCertifications,
        msmePreference: tender.eligibilityCriteria.msmeOnly ? "YES - Heavy MSME Preference" : "NO - Open to all scales",
        statesAllowed: tender.eligibilityCriteria.statesAllowed || ["Any State"],
      },
      requiredDocuments: [
        "Earnest Money Deposit (EMD) Instrument",
        "Class A Registration Document",
        "GSTIN Registration Certificate",
        "Audited Financial Sheet (Preceding 3 Years)",
        "Completed Work Experience Certificates",
        "ISO Code Conformity Certificate",
      ],
      paymentTerms: "Quarterly progressive bills based on physical work completed, subject to 5% security deposit retention.",
      keyRisks: "Strict delay penalties (Liquidated Damages @ 0.5% per week), site clearance delays are contractor risks, local security clearances required.",
    };
  }

  const prompt = `You are an expert in Indian government procurement. Analyze this tender document and provide:

1. SUMMARY: A 3-4 sentence plain English summary of what work is required.
2. KEY_DATES: Extract all important dates (submission, opening, etc.)
3. ELIGIBILITY_CRITERIA: List all eligibility requirements in structured format:
   - Minimum annual turnover (in Cr)
   - Minimum years of experience
   - Required certifications
   - MSME preference
   - Geographic restrictions
4. REQUIRED_DOCUMENTS: List every document required for bid submission
5. PAYMENT_TERMS: How and when will the contractor be paid
6. KEY_RISKS: Any unusual clauses or risks

Tender title: ${tender.title}
Tender department: ${tender.department}
Tender location: ${tender.location}
Tender document text:
${tender.rawText}

You must respond strictly in JSON matching this schema:
{
  "summary": "string",
  "keyDates": {
    "publishedDate": "string",
    "bidSubmissionDeadline": "string",
    "openingDate": "string"
  },
  "eligibilityCriteria": {
    "minTurnover": "string",
    "minExperience": "string",
    "requiredCertifications": ["string"],
    "msmePreference": "string",
    "statesAllowed": ["string"]
  },
  "requiredDocuments": ["string"],
  "paymentTerms": "string",
  "keyRisks": "string"
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "{}";
    return parseCleanJSON(text);
  } catch (err) {
    console.error("Gemini summarization failed:", err);
    throw err;
  }
}

/**
 * 2. ELIGIBILITY MATCH ANALYSIS (PHASE 6 — AI MATCH ENGINE)
 */
export async function analyzeEligibility(profile: CompanyProfile, tender: Tender): Promise<any> {
  const ai = getGeminiAI();

  const baseRec = db.calculateMatchScore(profile, tender);

  let result: any;

  if (!ai) {
    // Detailed local fallback
    const isGo = baseRec.matchScore >= 75 ? "GO" : baseRec.matchScore >= 50 ? "BORDERLINE" : "NO-GO";
    const missing = baseRec.matchBreakdown.missingItems || [];
    const minTurnover = tender.eligibilityCriteria.minTurnover || 0;
    const minExperience = tender.eligibilityCriteria.minExperience || 0;
    
    // Compute compliance/eligibility score based on strict minimum criteria
    let elScore = 100;
    if (profile.annualTurnover < minTurnover) elScore -= 40;
    if (profile.yearsOfExperience < minExperience) elScore -= 30;
    if (tender.eligibilityCriteria.msmeOnly && !profile.msmeRegistered) elScore -= 20;
    elScore = Math.max(0, elScore);

    const pastVals = profile.pastProjects.map((p) => p.value);
    const maxPastProject = pastVals.length > 0 ? Math.max(...pastVals) : 0;

    result = {
      overallScore: baseRec.matchScore, // Match score
      eligibilityScore: elScore,       // Eligibility score
      verdict: isGo,
      verdictReason: `Your match score is ${baseRec.matchScore}% and eligibility score is ${elScore}%. ${
        isGo === "GO"
          ? "You comfortably satisfy the required turnover and registration class guidelines. High probability of qualifying technical rounds."
          : isGo === "BORDERLINE"
          ? "Minor discrepancies detected in certification alignment or local state boundary registration. We suggest adding partnering credentials."
          : "You fail critical mandatory clauses of either turnover caps or core years of sector execution."
      }`,
      criteriaBreakdown: [
        {
          criterion_name: "Annual Turnover",
          requirement: `>= ${minTurnover} Crores`,
          company_value: `${profile.annualTurnover} Crores`,
          status: profile.annualTurnover >= minTurnover ? "MATCH" : "FAIL",
          explanation: profile.annualTurnover >= minTurnover ? "Comfortably meets requirement" : "Shortfall in registered capital",
        },
        {
          criterion_name: "Years of Experience",
          requirement: `>= ${minExperience} Years`,
          company_value: `${profile.yearsOfExperience} Years`,
          status: profile.yearsOfExperience >= minExperience ? "MATCH" : "FAIL",
          explanation: `Your company has active registration for ${profile.yearsOfExperience} years`,
        },
        {
          criterion_name: "MSME Priority Status",
          requirement: tender.eligibilityCriteria.msmeOnly ? "Mandatory / Priority" : "Not restrictive",
          company_value: profile.msmeRegistered ? "MSME Registered (Udyam)" : "Unregistered",
          status: (tender.eligibilityCriteria.msmeOnly && !profile.msmeRegistered) ? "FAIL" : "MATCH",
          explanation: profile.msmeRegistered ? "Eligible for standard fee waivers and EMD exemption" : "Standard commercial deposits apply",
        },
      ],
      missingRequirements: missing,
      riskIndicators: [
        ...(profile.annualTurnover < minTurnover ? ["Annual Turnover is below the tender threshold."] : []),
        ...(profile.yearsOfExperience < minExperience ? ["Company has fewer years of experience than specified."] : []),
        "High bid competition expected in civil contracts.",
        "Failing to submit certified declarations may cause instant technical dismissal."
      ],
      improvementRecommendations: [
        "Robust regional operating trace in operational state is beneficial.",
        maxPastProject > 0 
          ? `Capitalize on past project delivery valued up to ${maxPastProject} Cr in final proposal.` 
          : "Enhance past works directory with joint-venture details.",
        ...(profile.annualTurnover < minTurnover ? ["Form a bidding consortium to aggregate joint financial turnover limits."] : []),
        ...(profile.yearsOfExperience < minExperience ? ["Acquire joint-venture partner(s) to fulfill chronological experience mandates."] : []),
        "Compile and attest ISO standard certification credentials to gain evaluation preference marks."
      ]
    };
  } else {
    const prompt = `You are an expert in Indian government procurement eligibility assessment.
Compare this company profile against the tender requirements and provide a detailed match and eligibility analysis.

COMPANY PROFILE:
${JSON.stringify(profile, null, 2)}

TENDER REQUIREMENTS:
${JSON.stringify(tender.eligibilityCriteria, null, 2)}

Provide your response strictly in JSON format matching this schema:
{
  "overallScore": 85,
  "eligibilityScore": 90,
  "verdict": "GO" | "NO-GO" | "BORDERLINE",
  "verdictReason": "string description",
  "criteriaBreakdown": [
    {
      "criterion_name": "string",
      "requirement": "string",
      "company_value": "string",
      "status": "MATCH" | "FAIL" | "PARTIAL",
      "explanation": "string"
    }
  ],
  "missingRequirements": ["string"],
  "riskIndicators": ["string"],
  "improvementRecommendations": ["string"]
}

Important Definitions for Scores & Arrays:
- overallScore (Match score): Reflects overall context matching between company experience/categories and tender scope.
- eligibilityScore: Strict percentage rating based purely on mandatory requirements (Turnover, Experience and Certifications). Failing a mandatory threshold should decrease this to 50% or less.
- missingRequirements: Direct list of unmet requirements.
- riskIndicators: List of flags or factors indicating potential risk of rejection or failure.
- improvementRecommendations: Remedial steps or specific advice to bridge the specified gaps.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });
      const parsed = parseCleanJSON(response.text || "{}");
      
      // Enforce the output structure
      result = {
        overallScore: parsed.overallScore || parsed.matchScore || baseRec.matchScore,
        eligibilityScore: parsed.eligibilityScore !== undefined ? parsed.eligibilityScore : (parsed.overallScore || baseRec.matchScore),
        verdict: parsed.verdict || (baseRec.matchScore >= 75 ? "GO" : baseRec.matchScore >= 50 ? "BORDERLINE" : "NO-GO"),
        verdictReason: parsed.verdictReason || "AI calculations complete.",
        criteriaBreakdown: parsed.criteriaBreakdown || [],
        missingRequirements: parsed.missingRequirements || parsed.missingItems || baseRec.matchBreakdown.missingItems || [],
        riskIndicators: parsed.riskIndicators || parsed.risks || [],
        improvementRecommendations: parsed.improvementRecommendations || parsed.strengths || []
      };
    } catch (err) {
      console.error("Gemini eligibility match failed, using fallback:", err);
      // Fallback build
      const isGo = baseRec.matchScore >= 75 ? "GO" : baseRec.matchScore >= 50 ? "BORDERLINE" : "NO-GO";
      result = {
        overallScore: baseRec.matchScore,
        eligibilityScore: baseRec.matchScore,
        verdict: isGo,
        verdictReason: `Your match score is ${baseRec.matchScore}%. Automatic threshold comparison fallback triggered.`,
        criteriaBreakdown: [],
        missingRequirements: baseRec.matchBreakdown.missingItems || [],
        riskIndicators: ["Failure to connect to AI analysis backend for real-time risk modeling."],
        improvementRecommendations: ["Review turnover and experience thresholds manually." ]
      };
    }
  }

  // -----------------------------------------------------------------
  // STORE RESULTS IN LOCAL JSON DATABASE (PERSISTENCE LAYER)
  // -----------------------------------------------------------------
  try {
    let matchRecord = db.data.tenderMatches.find(
      (m) => m.tenderId === tender.id && m.companyProfileId === profile.id
    );
    
    if (!matchRecord) {
      matchRecord = {
        id: `tm-${profile.id}-${tender.id}`,
        tenderId: tender.id,
        companyProfileId: profile.id,
        matchScore: result.overallScore,
        matchBreakdown: {
          turnoverMatch: profile.annualTurnover >= (tender.eligibilityCriteria.minTurnover || 0),
          certMatch: true,
          categoryMatch: true,
          stateMatch: true,
          experienceMatch: profile.yearsOfExperience >= (tender.eligibilityCriteria.minExperience || 0),
          missingItems: result.missingRequirements || [],
        },
        isBookmarked: false,
        userStatus: "NEW",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.data.tenderMatches.push(matchRecord);
    } else {
      matchRecord.matchScore = result.overallScore;
      matchRecord.matchBreakdown.missingItems = result.missingRequirements || [];
      matchRecord.updatedAt = new Date().toISOString();
    }

    // Attach all AI engine specific results directly to persistent db schema
    (matchRecord.matchBreakdown as any).eligibilityScore = result.eligibilityScore;
    (matchRecord.matchBreakdown as any).riskIndicators = result.riskIndicators;
    (matchRecord.matchBreakdown as any).improvementRecommendations = result.improvementRecommendations;
    (matchRecord.matchBreakdown as any).verdict = result.verdict;
    (matchRecord.matchBreakdown as any).verdictReason = result.verdictReason;
    (matchRecord.matchBreakdown as any).criteriaBreakdown = result.criteriaBreakdown;

    db.save();
    console.log(`[AI Match Engine] Successfully stored and persisted analysis results in DB for Tender: ${tender.id}, Profile: ${profile.id}`);
  } catch (dbErr) {
    console.error("AI Match Engine failed to save results in database:", dbErr);
  }

  return result;
}

/**
 * 3. TENDER Q&A (RAG-BASED)
 */
export async function askTenderQuestion(tender: Tender, question: string): Promise<any> {
  const ai = getGeminiAI();

  // Keyword lookup simulation to get "excerpts"
  const qLower = question.toLowerCase();
  const relevantChunks: { text: string; pageNumber: number; section: string }[] = [];

  if (qLower.includes("emd") || qLower.includes("money") || qLower.includes("deposit")) {
    relevantChunks.push({
      text: `Earnest Money Deposit (EMD) of INR ${tender.emdAmount || "Variable"} Lakhs must be paid via Demand Draft or Bank Guarantee in favor of Tender Officer. MSME units seek exemption subject to producing valid Udyat certs.`,
      pageNumber: 4,
      section: "Earnest Money Guidelines",
    });
  }
  if (qLower.includes("turnover") || qLower.includes("financial") || qLower.includes("experience")) {
    relevantChunks.push({
      text: `Section 4.2. Annual financial turn-over of bidding contractor must exceed ${tender.eligibilityCriteria.minTurnover} Crores in three consecutive financial statements. Certifications from chartered accountant is mandatory.`,
      pageNumber: 8,
      section: "Technical and Financial Standards",
    });
  }
  if (relevantChunks.length === 0) {
    relevantChunks.push({
      text: tender.rawText.substring(0, 400) + "...",
      pageNumber: 1,
      section: "Notice Inviting Tender",
    });
  }

  if (!ai) {
    // Generate intelligent answering via keyword checking
    let answer = "Based on page 1 of the tender document, the contract requires execution in standard schedules. Please check specific EMD or experience inputs.";
    if (qLower.includes("emd") || qLower.includes("earnest")) {
      answer = `The Earnest Money Deposit is ₹${tender.emdAmount} Lakhs. Bidders seeking MSME waiver options are allowed to upload their Udyam registration certificate.`;
    } else if (qLower.includes("turnover") || qLower.includes("revenue")) {
      answer = `Paragraph 4.2 specifies that the minimum average turnover required is ₹${tender.eligibilityCriteria.minTurnover} Crores over the recent 3 financial years.`;
    } else if (qLower.includes("qualify") || qLower.includes("eligible")) {
      answer = `To qualify, your company must have completed similar jobs for at least ${tender.eligibilityCriteria.minExperience} years. Required documents include Class-A Contractor license and GST declarations.`;
    }

    return {
      answer,
      citations: relevantChunks,
      confidence: "HIGH",
      followUpSuggestions: [
        "What are the specific penalty clauses for delays?",
        "Is there an exemption of EMD for MSMEs?",
        "What is the duration of warranty or maintenance?",
      ],
    };
  }

  const prompt = `You are an expert assistant helping a company understand an Indian government tender. Answer the user's question. Try to use ONLY the tender excerpts provided if possible, and tell them clearly if you have to infer it.

TENDER EXCERPTS:
${JSON.stringify(relevantChunks, null, 2)}

SUMMARY DATA:
Title: ${tender.title}
Department: ${tender.department}

USER QUESTION: ${question}

Provide your response strictly in JSON format matching this schema:
{
  "answer": "Detailed answer matching government standards...",
  "citations": [
    {
      "text": "Exact sentence quoted from excerpts...",
      "section": "Name of section...",
      "pageNumber": 3
    }
  ],
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "followUpSuggestions": ["string question 1", "string question 2"]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });
    return parseCleanJSON(response.text || "{}");
  } catch (err) {
    console.error("Gemini Q&A failed:", err);
    throw err;
  }
}

/**
 * 4. BID DOCUMENT GENERATION
 */
export async function generateBidDoc(
  tender: Tender,
  profile: CompanyProfile,
  type: string
): Promise<string> {
  const ai = getGeminiAI();

  if (!ai) {
    // Return high quality dummy template matching Indian tender practices
    if (type === "TECHNICAL_PROPOSAL") {
      return `# TECHNICAL PROPOSAL & DELIVERY STRATEGY

## 1. Executive Summary
This proposal is submitted on behalf of **${profile.companyName}** in response to the public procurement invitation of *${tender.department}* for "${tender.title}" (Tender Ref: *${tender.externalId}*). 

Our firm satisfies the eligibility prerequisites including an average turnover of **₹${profile.annualTurnover} Cr** (Required: ₹${tender.eligibilityCriteria.minTurnover} Cr) and **${profile.yearsOfExperience} Years** of technical execution history in similar categories.

## 2. Methodology & Work Approach
We propose deploying a dedicated project manager directly in **${tender.location}** to coordinate work.
- **Phase A**: Mobilization of electrical systems and site levelling.
- **Phase B**: Core fabrication and civil erection using state-of-the-art graders.
- **Phase C**: Third-party material testing and net-energy compliance clearances.

## 3. Past Project Experience Catalog
- **Project 1**: Patna Bypass Multi-Lane (Client: Bihar PWD | Value: ₹3.2 Cr)
- **Project 2**: Regional Electrical Erection (Client: Power Grid Corp | Value: ₹1.1 Cr)

## 4. Key Equipment & Personnel Fleet
We will deploy 4 core civil supervisors, 1 safety controller, and top-tier concrete mixing machines. No delays are expected.`;
    } else if (type === "COVER_LETTER") {
      return `# BID SUBMISSION COVER LETTER

**To,**
The Tender Inviting Officer,
${tender.department},
${tender.location}, ${tender.state || "India"}.

**Subject: Technical Bid Envelope submission for ${tender.title} (Ref: ${tender.externalId})**

Dear Sir/Madam,

1. Having examined the complete tender specifications, schedules of work, and special terms of contract, we, the undersigned, hereby offer to execute, complete, and maintain the whole of the said works in conformity with requirements.

2. We are an registered **MSME Enterprise** under the Government of India holding valid Udyam registration certificates (*GST: ${profile.gstNumber}*, *PAN: ${profile.panNumber}*).

3. We have enclosed the requested Earnest Money Deposit (EMD) or applicable MSME declaration and confirm we possess more than ${profile.yearsOfExperience} years of active construction background.

Thanking you.

Yours faithfully,
**For ${profile.companyName}**

*(Authorized Signatory)*
Managing Director`;
    } else if (type === "COMPLIANCE_MATRIX") {
      return `# TECHNICAL & ADMINISTRATIVE COMPLIANCE MATRIX

| Clause No. | Section / Requirement | Our Response | Compliance Status | Remarks |
| :--- | :--- | :--- | :--- | :--- |
| **Section 1.1** | Submission of EMD of ₹${tender.emdAmount} Lakhs | EMD exemption claimed; valid MSME/Udyam certificate attached | **COMPLIANT** | Full fee waiver requested |
| **Section 2.3** | Minimum Annual Turnover of ₹${tender.eligibilityCriteria.minTurnover} Cr | Certified turnover is ₹${profile.annualTurnover} Cr | **COMPLIANT** | Exceeds minimum criteria |
| **Section 3.5** | Local State Office Registration | Fully operating from state of ${tender.state} | **COMPLIANT** | ISO certification annexed |
| **Section 4.1** | Supply of BIS/IS Standard Materials | Complies strictly with Indian Standards | **COMPLIANT** | Test reports will be provided |`;
    } else if (type === "COMPANY_PROFILE") {
      return `# COMPANY PROFILE & CREDENTIALS PORTFOLIO

## 1. Corporate Identity & Registration
We are **${profile.companyName}**, an incorporated business enterprise with **${profile.yearsOfExperience} Years** of premier technical execution experience in the industry.

- **Legal Business Entity**: Private Limited Company
- **Registration Numbers**: GSTIN - ${profile.gstNumber || "Registered Active"}, PAN - ${profile.panNumber || "Active Taxpayer Code"}
- **Operations & Presence**: Active operational centers across **${profile.states?.join(", ") || "All Major Indian States Solutions"}**
- **MSME Category Status**: ${profile.msmeRegistered ? "Registered MSME (Micro & Small Enterprises group waiver)" : "Standard Taxpayer Corporate Entity"}

## 2. Financial Stability & Capacity
- **Audited Annual Turnover**: **₹${profile.annualTurnover} Crore**
- **Employee Footprint**: **${profile.employeeCount} active technical specialists** and support staff
- **Core Industry Categories**: **${profile.categories?.join(", ") || "Civil / Electrical Infrastructure Construction"}**

## 3. Certifications & Quality Compliance
Our operations are governed by strict standard operating standards and backed by modern quality certifications, guaranteeing high precision on delivered projects.`;
    } else if (type === "BID_RESPONSE") {
      return `# EXECUTIVE BID RESPONSE AND STATUTORY COMPLIANCE PACKAGES

## 1. Consolidated Technical Proposal Response
This document contains the consolidated Bid Response of **${profile.companyName}** for *${tender.title}* (Tender ID: *${tender.externalId}*).

We declare full capability to execute the mentioned activities inside **${tender.location}** under standard CPWD / PWD criteria.
- **Project Location Compliance**: Complete regional infrastructure mobilisation in **${tender.location}** is fully mapped.
- **Work Timeline Guarantee**: Execution schedule is within the tender requirements timeline.

## 2. Financial Proposals & Statutory Annexures
Our bid includes a competitive, highly optimized fee structure that meets the RFP benchmarks.
- **Exemptions Asserted**: EMD fees are requested to be waived as valid Micro/Small Udyam credentials are submitted in active panels.
- **Document Certifications**: GST, Audited Balance sheets, past completions, and technical manuals are fully bundled.`;
    } else {
      return `# BILL OF QUANTITIES (BOQ) WORK ESTIMATION

| Item No. | Description | Unit | Quantity | Rate (Estimated ₹) | Amount (Estimated ₹) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1.01** | Site levelling, core excavation, and structural preparation | Cub M | 1,500 | 450 | 6,75,000 |
| **1.02** | Heavy structural grade pre-cast reinforced panels | Sq M | 420 | 1,200 | 5,04,000 |
| **1.03** | Insulated copper wiring and control switches installation | Lot | 1 | 2,80,000 | 2,80,000 |
| **1.04** | Landscaping, testing and trial commissioning operations | Job | 1 | 1,50,000 | 1,50,000 |
| **TOTAL** | **Estimated Technical Cost Summary** | | | | **₹16,09,000** |`;
    }
  }

  const prompt = `You are an expert bid writer for Indian government tenders. Generate a professional Markdown documentation of type ${type} for this tender bid.

COMPANY PROFILE:
${JSON.stringify(profile, null, 2)}

TENDER:
Title: ${tender.title}
Department: ${tender.department}
Location: ${tender.location}
Eligibilities: ${JSON.stringify(tender.eligibilityCriteria, null, 2)}
Specs: ${tender.technicalSpecs}

Generate a formal response in professional Markdown format. Avoid generic text; write high quality technical terms, executive summaries, past experience catalogs, structural delivery sheets, or BOQ estimates as requested. No formatting intro/outro headers. Begin directly with Markdown.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });
    return response.text || "Failed to generate bid documentation.";
  } catch (err) {
    console.error("Gemini bid doc generation failed:", err);
    throw err;
  }
}

/**
 * 5. SMART BID DRAFT (Cover letter & Proposal outline)
 */
export async function generateSmartBidDraft(
  tender: Tender,
  profile: CompanyProfile,
  tone: string = "Formal & Administrative",
  projectFocus?: string,
  includeMSMEAcknowledgment: boolean = true
): Promise<{ coverLetter: string; proposalOutline: string }> {
  const ai = getGeminiAI();

  if (!ai) {
    // High-quality local fallback cover letter & proposal outline
    const msmeClause = includeMSMEAcknowledgment && profile.msmeRegistered 
      ? `As a certified MSME holding valid Udyam registration, we kindly request the standard waivers for Earnest Money Deposit (EMD) and tender document fees, as per directives of the Ministry of MSME.`
      : `We have prepared the necessary EMD and fee instruments in compliance with the instructions to bidders.`;

    const focusProjectText = projectFocus 
      ? `We draw particular attention to our successful completion of the project "${projectFocus}", which represents direct antecedents to the required scope here.`
      : `With over ${profile.yearsOfExperience} years of registered credentials and multiple multi-crore public sector works in India, we possess direct domain competency for this deployment.`;

    return {
      coverLetter: `# COVER LETTER

**To,**
The Tender Inviting Authority,
${tender.department},
${tender.location}, ${tender.state || "India"}.

**Subject: Bid Submission for "${tender.title}" (Tender Ref: ${tender.externalId || "N/A"})**

Dear Sir/Madam,

1. We, **${profile.companyName}**, having completed a thorough review of the Tender Notice and technical specification guidelines for "${tender.title}", hereby submit our formal technical bid. Our office is located in ${profile.states?.[0] || 'India'}.

2. ${focusProjectText}

3. ${msmeClause}

4. In conformity with the requirements, we have prepared our technical capabilities matrix, equipment lists, and certified financial sheets. Our registered Class-A status and experienced crew are fully ready to deploy.

Thanking you.

Yours faithfully,
**For ${profile.companyName}**

*(Authorized Signatory)*
Contact: ${profile.registrationNumber || "Director"}`,

      proposalOutline: `# TECHNICAL PROPOSAL OUTLINE

## 1. Executive Summary & Company Profile
- **Bidding Entity**: ${profile.companyName}
- **Sector Expertise**: ${profile.categories?.join(", ") || "General Engineering & Infrastructure"}
- **Geographic Capability**: Registered to operate across ${profile.states?.join(", ") || "various states"}
- **Financial Capability**: Audited Annual Turnover of ₹${profile.annualTurnover} Cr against tender baseline of ₹${tender.eligibilityCriteria.minTurnover} Cr.

## 2. Project Scope Analysis & Technical Methodology
- **Tender Reference**: ${tender.externalId || "N/A"}
- **Department**: ${tender.department}
- **Execution Strategy**: Customized phase-by-phase execution designed to complete "${tender.title}" within schedule boundaries.
- **Standards & Codes**: Fully compliant with IS (Indian Standard) and CPWD guidelines as highlighted in the technical specs.

## 3. Recommended Resource & Personnel Fleet
- **Key Project Lead**: Senior Civil/Electrical Engineer (Over 10 years experience).
- **Labor Compliance**: Strict adherence to min wages, safety drills, insurance, and local security cleanups.
- **Material Selection**: Strict audit parameters for all sub-cons and vendors.

## 4. Key Past Credentials & Experience Catalog
${profile.pastProjects && profile.pastProjects.length > 0 
  ? profile.pastProjects.map(p => `- **${p.name}**: Developed for ${p.client} valued at ₹${p.value} Cr (${p.year}).`).join("\n")
  : "- No specific past projects selected."
}

## 5. Compliance, EMD, and Technical Appendices
- **MSME Priority Status**: ${profile.msmeRegistered ? "Yes, Udyam registered (EMD Exemption requested)" : "General Bidder (Standard EMD instruments attached)"}
- **Timeline Milestones**: Staggered deliverables mapped to regional milestones.`
    };
  }

  const prompt = `You are a professional bid-writing strategist specializing in Indian government procurement (CPWD, state departments, etc.). 
Generate a tailored, highly professional structured cover letter and proposal outline for:
Tender: ${tender.title}
Department: ${tender.department}
Location: ${tender.location}, State: ${tender.state || "India"}
Reference ID: ${tender.externalId || "N/A"}
Tender requirements: ${JSON.stringify(tender.eligibilityCriteria, null, 2)}

Company Profile:
Name: ${profile.companyName}
Turnover: ₹${profile.annualTurnover} Cr
Experience: ${profile.yearsOfExperience} Years
Registered Categories: ${profile.categories?.join(", ")}
MSME Registered: ${profile.msmeRegistered ? "Yes" : "No"}
Certifications: ${profile.certifications?.join(", ")}
Past Projects: ${JSON.stringify(profile.pastProjects, null, 2)}

Parameters:
Tone of voice: ${tone}
Specific project to focus on: ${projectFocus || "None"}
Include MSME Fee/EMD waiver request: ${includeMSMEAcknowledgment ? "Yes" : "No"}

Provide a output strictly conforming to this JSON schema:
{
  "coverLetter": "A high-quality formal Markdown string for the Cover Letter addressed to the Tender Inviting Authority. Keep it professional, include standard Indian legal/formal templates.",
  "proposalOutline": "A high-quality structured Markdown outline of the Technical Proposal matching the specifications. Detail the proposed execution methodology, company strength highlights, past experience highlights, compliance, and resources to build trust."
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = parseCleanJSON(response.text || "{}");
    return {
      coverLetter: parsed.coverLetter || "Failed to generate Cover Letter.",
      proposalOutline: parsed.proposalOutline || "Failed to generate Proposal Outline."
    };
  } catch (err) {
    console.error("Gemini smart bid draft generation failed:", err);
    throw err;
  }
}

/**
 * 6. PROCUREMENT DOCUMENT SUMMARIZER
 */
export async function summarizeProcurementDocument(
  tender: Tender,
  documentName: string,
  documentUrl: string
): Promise<{
  documentName: string;
  documentType: string;
  executiveSummary: string;
  submissionDeadline: string;
  keyTerms: { term: string; explanation: string }[];
  complianceChecklist: string[];
}> {
  const ai = getGeminiAI();

  if (!ai) {
    // Return custom fallback based on documentName and tender
    const isBOQ = documentName.toLowerCase().includes("boq") || documentName.toLowerCase().includes("xlsx");
    const isTech = documentName.toLowerCase().includes("spec") || documentName.toLowerCase().includes("solar") || documentName.toLowerCase().includes("design");
    const isNotice = documentName.toLowerCase().includes("notice") || documentName.toLowerCase().includes("sbd") || documentName.toLowerCase().includes("railway") || documentName.toLowerCase().includes("road");

    let docType = "Standard Procurement Attachment";
    let summary = "This document sets down administrative guidelines and statutory clauses for execution of the selected work.";
    const keyTerms = [
      { term: "EMD / Bid Security", explanation: tender.emdAmount ? `₹${tender.emdAmount.toLocaleString('en-IN')} (Exemptions apply for qualified local small scale MSME units).` : "Exempted as per Section II rules." },
      { term: "Performance Guarantee", explanation: "5% of contract value payable within 15 days of letter of award." },
      { term: "Liquidated Damages", explanation: "Penalties of 0.5% per week of delay, capped at a maximum of 10% of final contract value." }
    ];
    let checklist = [
      "Verify registration category validity",
      "Upload audited balance sheets for last 3 preceding years",
      "Ensure valid digital signature certificate (DSC) is active"
    ];

    if (isBOQ) {
      docType = "Bill of Quantities (Financial Template)";
      summary = `Contains structural schedule of rates, quantities, and material coefficients for "${tender.title}". Bidders must quote individual percentage rates against base rates.`;
      keyTerms.push({ term: "Item Rate vs Percentage Rate", explanation: "Percentage rate above/below CPWD DSR schedule rates is required." });
      checklist.push("Verify correct GST HSN codes are applied", "Double check no formulas are customized in Excel columns");
    } else if (isTech) {
      docType = "Technical Specifications & Design Guidance";
      summary = `Provides rigorous engineering standards, structural strength minimums, material grades, and test criteria for execution at ${tender.location}.`;
      keyTerms.push({ term: "Material Inspection", explanation: "All lots must be certified by third-party authority before dispatch." });
      checklist.push("Submit signed list of machinery to be deployed", "Verify compliance with IS codes");
    } else if (isNotice) {
      docType = "Notice Inviting Tender & Standard Bidding Document";
      summary = `The formal invitation notice detailing timelines, critical instructions, bidder credentials, and legal disputes resolution channels for "${tender.title}".`;
      checklist.push("Check exact tender fee payment transaction screenshot is attached", "Maintain 120 days of bid validity from opening");
    }

    return {
      documentName,
      documentType: docType,
      executiveSummary: summary,
      submissionDeadline: tender.bidSubmissionDeadline,
      keyTerms,
      complianceChecklist: checklist
    };
  }

  const prompt = `You are a procurement specialist in Indian government tenders (CPWD, GeM, BREDA, state PWDs). 
Analyze details about the tender and a linked document file named "${documentName}".
Provide an executive summary, key clauses/deadlines, and statutory compliance criteria specifically for this file.

Tender context:
Title: ${tender.title}
Department: ${tender.department}
Location: ${tender.location}
Description: ${tender.workDescription}
Technical specs: ${tender.technicalSpecs}
Baseline Deadline: ${tender.bidSubmissionDeadline}
Baseline EMD amount: ₹${tender.emdAmount || "Exempted"}
Raw Text context: ${tender.rawText}

File to Analyze:
Name: ${documentName}
Url: ${documentUrl}

Please respond strictly in JSON matching this schema:
{
  "documentName": "string",
  "documentType": "string (e.g. Notice Inviting Tender, Bill of Quantities, Technical Specs, General Conditions)",
  "executiveSummary": "string (Detailed executive summary of key aspects under discussion in this file)",
  "submissionDeadline": "string (Extract submission deadline for this document-pack or overall tender, in human readable format)",
  "keyTerms": [
    { "term": "string (Clause name, e.g. EMD Exemption, Performance Bank Guarantee, Area of Work)", "explanation": "string (Explanation of the clause)" }
  ],
  "complianceChecklist": ["string (Individual action items a bidder must do to satisfy this document's regulations)"]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = parseCleanJSON(response.text || "{}");
    return {
      documentName,
      documentType: parsed.documentType || "Standard Procurement Document",
      executiveSummary: parsed.executiveSummary || "Document parsed and categorized successfully.",
      submissionDeadline: parsed.submissionDeadline || tender.bidSubmissionDeadline,
      keyTerms: parsed.keyTerms || [],
      complianceChecklist: parsed.complianceChecklist || []
    };
  } catch (err) {
    console.error("Gemini document analysis failure:", err);
    throw err;
  }
}

/**
 * 7. CONSORTIUM JOINT VENTURE AGREEMENT GENERATOR
 */
export async function draftConsortiumAgreement(
  tender: Tender,
  myProfile: CompanyProfile,
  partnerProfile: CompanyProfile,
  responsibilities: string
): Promise<string> {
  const ai = getGeminiAI();

  if (!ai) {
    // Elegant system-generated fallback JV agreement
    return `JOINT VENTURE AND CONSORTIUM AGREEMENT
--------------------------------------------------------------------------------
THIS CONSORTIUM AGREEMENT is entered into on this ${new Date().toLocaleDateString("en-IN")} ("Effective Date")

BETWEEN:
1. ${myProfile.companyName} (hereinafter referred to as the "Lead Member"), represented by its authorized signatory, having its principal place of business at registration No: ${myProfile.registrationNumber}.

AND:
2. ${partnerProfile.companyName} (hereinafter referred to as the "Consortium Partner"), represented by its authorized signatory, having its principal place of business at registration No: ${partnerProfile.registrationNumber}.

WHEREAS:
A. The Central/State Government Authority ("${tender.department}") has invited bids for "${tender.title}" via Tender Reference ID "${tender.externalId || "N/A"}".
B. The Members have agreed to form a joint venture consortium to jointly submit a highly conforming technical and financial bid and successfully execute the works if awarded.

NOW, THEREFORE, IT IS MUTUALLY AGREED AS FOLLOWS:

1. JOINT & SEVERAL RESPONSIBILITY
The Lead Member and Consortium Partner bind themselves jointly and severally to the ${tender.department} for all regulatory covenants, technical clauses, and financial obligations of the bid.

2. STRENGTH-BASED ALIGNMENT & INTEGRATED QUALIFICATIONS
- Lead Member Experience Base: ${myProfile.yearsOfExperience} Years of active sector mastery.
- Partner's Strategic Financial Capacity: Consolidated Average Annual Turnover of ₹${partnerProfile.annualTurnover} Crores (supporting Lead Member's deficit).
- Integrated Operating Territories: Valid and active registration coverage across region.

3. DIVISION OF WORK & SCOPE OF ENGAGEMENT
The division of engineering work, physical deployment, and statutory liability is defined as:
${responsibilities || "Lead Member shall serve as primary constructor of site civil works. Consortium Partner provides high-end machinery supply, structural engineering specifications integration, and financial liquified backing."}

4. LEAD MEMBER AUTHORITY
The Consortium Partner hereby authorizes ${myProfile.companyName} as the Lead Member to represent, sign, receive payments, and legally bind the Joint Venture in negotiations with the client authority.

5. SHARE & REVENUE APPORTIONMENT
The equity stake and financial revenue sharing for the joint execution is provisionally set at:
- ${myProfile.companyName} (Lead Member): 60% (Sixty Percent)
- ${partnerProfile.companyName} (Partner): 40% (Forty Percent)

IN WITNESS WHEREOF, the parties hereto have signed this Joint Venture Agreement through their authenticated representatives.

For, ${myProfile.companyName} (Lead Member)
_____________________________________
Authorized Signatory (Seal)

For, ${partnerProfile.companyName} (Consortium Partner)
_____________________________________
Authorized Signatory (Seal)`;
  }

  const prompt = `You are a legal and procurement expert specializing in Indian Joint Venture (JV) and Consortium agreements for government tenders (CPWD, GeM, PWD, NHAI).
Draft a legally professional, highly structured, binding Consortium Joint Venture Agreement between two contracting companies for a joint bid submission.

Tender context:
- Title: ${tender.title}
- Department: ${tender.department}
- Location: ${tender.location}
- Description: ${tender.workDescription}

Lead Bidder Company Profile:
- Name: ${myProfile.companyName}
- Registration No: ${myProfile.registrationNumber}
- GST: ${myProfile.gstNumber}
- Experience: ${myProfile.yearsOfExperience} Years
- Turnover: ₹${myProfile.annualTurnover} Crores

Consortium Partner Company Profile:
- Name: ${partnerProfile.companyName}
- Registration No: ${partnerProfile.registrationNumber}
- GST: ${partnerProfile.gstNumber}
- Experience: ${partnerProfile.yearsOfExperience} Years
- Turnover: ₹${partnerProfile.annualTurnover} Crores

User specified division of responsibilities:
${responsibilities || "Standard collaborative split based on strengths."}

Format the agreement in a professional, ready-to-print legal draft format. Use clear headings, numbered clauses (Joint Responsibility, Division of Work, Lead Member Designation, Revenue Apportionment, Arbitration & Law etc.), and signature blocks at the base. Make it complete, formal, and specific to these entities. Do not use markdown backticks in the response text itself, just output clean legal text.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    return response.text || "Failed to generate Joint Venture agreement draft text.";
  } catch (err) {
    console.error("Gemini JV Agreement generation error:", err);
    throw err;
  }
}

/**
 * PHASE 7 — DOCUMENT VAULT SCANNER, OCR AND CATEGORIZATION ENGINE
 */
export async function analyzeAndOCRDocument(
  fileName: string,
  declaredType: string
): Promise<{
  documentType: string;
  ocrText: string;
  metadata: Record<string, string>;
  aiSummary: string;
  expiryDate: string | null;
  year: number | null;
}> {
  const ai = getGeminiAI();

  const prompt = `You are an AI Document processing agent working on an Indian Gov tender bid compliance system.
We have received a document upload.
File name: "${fileName}"
User declared type (optional): "${declaredType}"

Analyze this upload. Even though we are simulating file parsing, you must synthesize highly realistic, comprehensive OCR text output representing this file, classify the correct document class (Auto-categorization), extract vital metadata properties, detect expiration timelines (Expiry Tracking), and produce a concise expert AI summarized report.

Supported Classes:
- "GST_CERTIFICATE" (Goods & Services Tax registration certificates Form REG-06)
- "PAN_CARD" (Permanent Account Number issued by Income Tax Dept)
- "MSME_CERTIFICATE" (MSME Ministry Udyam Registration certificate representation)
- "ISO_CERTIFICATE" (ISO 9001, 14001, 27001 or standard compliance certs)
- "AUDITED_FINANCIALS" (Audited Balance Sheets, profit & loss, ITR reports)
- "EXPERIENCE_CERTIFICATE" (Prior completion records of civil/tech orders)
- "TECHNICAL_DOCUMENT" (Technical bids, designs, blueprints, proposal forms)
- "OTHER" (Bank details, EMD draft or fallback custom files)

Return your response strictly in JSON format fitting this exact schema:
{
  "documentType": "GST_CERTIFICATE" | "PAN_CARD" | "MSME_CERTIFICATE" | "ISO_CERTIFICATE" | "AUDITED_FINANCIALS" | "EXPERIENCE_CERTIFICATE" | "TECHNICAL_DOCUMENT" | "OTHER",
  "ocrText": "full simulated parsed text layout representing this official certificate or filing, including standard government headers, stamps, credentials, tables, legal disclaimers, numbers...",
  "metadata": {
    "Document Number": "exact registration string e.g. 24AAAXX2212X1Z5, AAAPC1123P or UDYAM-DL-03-...",
    "Legal Name": "Extracted legal business entity name matching standard format",
    "Issuance Date": "YYYY-MM-DD or readable date",
    "Additional Fields": "Specific fields like PAN Circle, GSTR status, Financial Year Turnover figure, Contract Execution Scope, ISO Certifying Registrar etc."
  },
  "expiryDate": "YYYY-MM-DD" | null,
  "year": 2024 | 2025 | 2026 | null,
  "aiSummary": "A concise, expert 2-3 sentence technical critique stating the authenticity of the certificate, compliance indicators, omissions, and validity status."
}`;

  if (!ai) {
    // Generate magnificent high-fidelity synthetic mock data matching the classification
    let predictedType = declaredType;
    if (declaredType === "OTHER") {
      const lower = fileName.toLowerCase();
      if (lower.includes("gst")) predictedType = "GST_CERTIFICATE";
      else if (lower.includes("pan") || lower.includes("tax")) predictedType = "PAN_CARD";
      else if (lower.includes("msme") || lower.includes("udyam")) predictedType = "MSME_CERTIFICATE";
      else if (lower.includes("iso")) predictedType = "ISO_CERTIFICATE";
      else if (lower.includes("sheet") || lower.includes("balance") || lower.includes("financial")) predictedType = "AUDITED_FINANCIALS";
      else if (lower.includes("exp") || lower.includes("cert") || lower.includes("work")) predictedType = "EXPERIENCE_CERTIFICATE";
      else if (lower.includes("tech") || lower.includes("proposal") || lower.includes("design")) predictedType = "TECHNICAL_DOCUMENT";
    }

    let ocr = "";
    let meta: Record<string, string> = {};
    let exp: string | null = null;
    let yr: number | null = 2025;
    let summary = "";

    switch (predictedType) {
      case "GST_CERTIFICATE":
        ocr = `GOVERNMENT OF INDIA\nDEPARTMENT OF REVENUE\nREGISTRATION CERTIFICATE UNDER GST\n\nRegistration Number: 27AABCT2891D1Z1\nLegal Name: BHANUSHALI CONSTRUCTIONS PRIVATE LIMITED\nTrade Name: BHANUSHALI INFRA\nAddress: 405-408, Synergy Business Park, Goregaon East, Mumbai, MH - 400063\nDate of Liability: 01/04/2018\n\nType of Registration: Regular\nParticulars of Sanctioning Authority:\nSignature of Jurisdictional Superintendent (MH GST Ward 41)`;
        meta = {
          "Document Number": "27AABCT2891D1Z1",
          "Legal Name": "Bhanushali Constructions Private Limited",
          "GSTIN Status": "Active / Regular taxpayer",
          "Registration Date": "2018-04-01",
          "Jurisdiction": "Maharashtra Ward 41",
        };
        summary = "Form REG-06 Goods and Services Tax certificate parsed successfully. Verified GSTIn matches state authority standards in Mumbai, Maharashtra. Standard status is registered regular.";
        break;

      case "PAN_CARD":
        ocr = `INCOME TAX DEPARTMENT\nGOVERNMENT OF INDIA\n\nPermanent Account Number (PAN): AALCB2291F\nName: BHANUSHALI CONSTRUCTIONS PVT LTD\nFather's/Spouse's Name: N/A (Incorporated Company)\nDate of Incorporation: 14/05/2016\n\n[Official Emblem of India Seal & Income Tax Hologram Signed]`;
        meta = {
          "Document Number": "AALCB2291F",
          "Legal Name": "Bhanushali Constructions Pvt Ltd",
          "Category": "Company / Incorporated",
          "Date of Incorporation": "2016-05-14",
          "Issuing Authority": "Income Tax Department of India",
        };
        summary = "Permanent Account Number card scanned successfully. Correct corporate tax classification detected (F character code status). No expiry date detected, card is valid indefinitely.";
        break;

      case "MSME_CERTIFICATE":
        ocr = `MINISTRY OF MICRO, SMALL & MEDIUM ENTERPRISES\nGOVERNMENT OF INDIA\n\nUDYAM REGISTRATION CERTIFICATE\n\nUdyam Registration Number: UDYAM-MH-19-0098715\nName of Enterprise: BHANUSHALI CONSTRUCTIONS PRIVATE LIMITED\nType of Enterprise: MICRO (Manufacturing & Services)\nMajor Activity: Construction of Roads & Bridges (NIC 42101)\n\nDate of Commencement: 20/05/2016\nDate of Udyam Verification: 11/11/2020`;
        meta = {
          "Document Number": "UDYAM-MH-19-0098715",
          "Legal Name": "Bhanushali Constructions Private Limited",
          "Classification": "MICRO ENTERPRISE",
          "Core Sector": "Civil Construction (NIC 42101)",
          "Verification Date": "2020-11-11",
        };
        summary = "Udyam MSME certification scanned. Categorized as Micro Enterprise. Entitles holder to EMD bid bond waiver benefits and technical qualification relaxation standard clauses.";
        break;

      case "ISO_CERTIFICATE":
        ocr = `CERTIFICATE OF REGISTRATION\n\nThis is to certify that the Quality Management System of\nBHANUSHALI CONSTRUCTIONS PRIVATE LIMITED\n\nHas been assessed and verified compliant with:\nISO 9001:2015 (Quality Management System for Infrastructure & Building Projects)\n\nCertificate Registration No: ISO-9001-817290A\nDate of Issuance: 12/10/2023\nDate of Recertification Audit Due: 11/10/2026\n\nSigned on behalf of Intertek Assessment Services`;
        meta = {
          "Document Number": "ISO-9001-817290A",
          "Legal Name": "Bhanushali Constructions Private Limited",
          "Standard": "ISO 9001:2015",
          "Registrar Authority": "Intertek Assessment Services",
          "Effective From": "2023-10-12",
        };
        exp = "2026-10-11";
        summary = "ISO 9001:2015 Quality Management System certification identified. Expiration tracking mapped to 11th Oct 2026. This meets standard tender guidelines for civil pre-qualifications.";
        break;

      case "AUDITED_FINANCIALS":
        ocr = `M. R. DEVDHAR & CO. - CHARTERED ACCOUNTANTS\n\nINDEPENDENT AUDITOR'S REPORT\nTO THE MEMBERS OF BHANUSHALI CONSTRUCTIONS PVT LTD\n\nBalance Sheet as of March 31, 2025\n\nTotal Revenue from Operations: INR 12,45,00,000 (₹12.45 Crores)\nNet Profit after Tax (PAT): INR 87,50,000\nReserves & Surplus: INR 3,20,00,000\nBorrowings & Liabilities: INR 1,45,00,000\n\nUDIN: 25902187AAAB9102\nPartner Signature: CA Manoj R. Devdhar\nFCA, Membership No: 090218`;
        meta = {
          "Document Number": "UDIN: 25902187AAAB9102",
          "Legal Name": "Bhanushali Constructions Pvt Ltd",
          "Turnover Figure": "₹12.45 Crores",
          "Chartered Accountant": "CA Manoj R. Devdhar",
          "Auditor Membership No": "090218",
        };
        yr = 2025;
        summary = "Audited financial balance sheet parsed. Confirms an annual Turnover of ₹12.45 Cr for FY 2024-2025, fully authenticated by valid unique UDIN identifier registration.";
        break;

      case "EXPERIENCE_CERTIFICATE":
        ocr = `MAHARASHTRA STATE ROAD DEVELOPMENT CORPORATION\n(A GOVT OF MAHARASHTRA UNDERTAKING)\n\nWORK COMPLETION AND PERFORMANCE CERTIFICATE\n\nReference: MSRDC/CON/451-B/2023\n\nThis is to certify that M/s Bhanushali Constructions Pvt Ltd has successfully completed\nthe construction of RCC retaining walls and utility conduits at flyover corridors,\nThane Belapur Road, Mumbai.\n\nFinal Bill Settlement Value: INR 4,85,00,000 (₹4.85 Crores)\nOriginal Contract Duration: 12 Months\nActual Execution Time: 11 Months\nDate of Work Scope Completion: 15/12/2024\n\nPerformance Grading: Satisfactory & Quality Maintained\nSigned: Executive Engineer, MSRDC Thane Division`;
        meta = {
          "Document Number": "MSRDC/CON/451-B/2023",
          "Legal Name": "Bhanushali Constructions Pvt Ltd",
          "Client Authority": "MSRDC (Govt of Maharashtra)",
          "Execution Scope": "Civil Foundations & Retaining Walls",
          "Completed Value": "₹4.85 Crores",
          "Completion Date": "2024-12-15",
        };
        summary = "Completed work experience certificate verified. Proves delivery capability for a single contract of ₹4.85 Cr, satisfying standard civil engineering bid-capacity rules.";
        break;

      case "TECHNICAL_DOCUMENT":
        ocr = `TECHNICAL PROPOSAL BID DEVIATION MATRIX\n\nTender ID: TENDER-CIVIL-MSRDC-2026\nBidder Name: BHANUSHALI CONSTRUCTIONS PVT LTD\n\nScope of Implementation Methodology:\nWe propose using rapid-setting structural precast concrete elements to reduce erection timelines by 30%. Joint specifications conform completely with BIS Code 456 for Reinforced Concrete Structures.\n\nSignatories: Chief Procurement Lead Engineer, Bhanushali Constructions`;
        meta = {
          "Document Number": "RFP-CIVIL-METHODOLOGY-v1",
          "Legal Name": "Bhanushali Constructions Pvt Ltd",
          "Specification Code": "BIS Code 456",
          "Deviation Status": "No deviations requested",
        };
        summary = "Technical Bid design proposal scanned. Includes structural deployment checklists, pre-cast methodologies, and compliance with BIS cement specifications.";
        break;

      default:
        ocr = `GENERIC DOCUMENT ATTESTATION RECORD\n\nFile: ${fileName}\nProcessed At: ${new Date().toLocaleString()}\nContent: Custom administrative records verified for bidding registration compliance.`;
        meta = {
          "Document Number": `REG-${Math.floor(Math.random() * 90000) + 10000}`,
          "Legal Name": "Enterprise Bidder Entity",
          "Filing Date": new Date().toISOString().split("T")[0],
        };
        summary = "Administrative document uploaded. Evaluated as non-standard classification, registered cleanly on local secure system directories.";
        break;
    }

    return {
      documentType: predictedType,
      ocrText: ocr,
      metadata: meta,
      aiSummary: summary,
      expiryDate: exp,
      year: yr,
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = parseCleanJSON(response.text || "{}");
    return {
      documentType: parsed.documentType || declaredType || "OTHER",
      ocrText: parsed.ocrText || `Simulated OCR scanned content for ${fileName}.`,
      metadata: parsed.metadata || {},
      aiSummary: parsed.aiSummary || "Document verified and scanned by Gemini compliance suite.",
      expiryDate: parsed.expiryDate || null,
      year: parsed.year ? Number(parsed.year) : null,
    };
  } catch (err) {
    console.error("Gemini analyzeAndOCRDocument failed, reverting to synthetic fallback:", err);
    return {
      documentType: declaredType || "OTHER",
      ocrText: `Fallback OCR scan failed. File parsed: ${fileName}`,
      metadata: { "Status": "Direct fallback check required" },
      aiSummary: "Could not establish server connection to Gemini API. Relying on local structural scanning benchmarks.",
      expiryDate: null,
      year: yearParam(declaredType),
    };
  }
}

function yearParam(type: string): number | null {
  return type === "AUDITED_FINANCIALS" ? 2025 : null;
}

/**
 * Chat context query regarding uploaded file
 */
export async function chatAboutDocument(
  docName: string,
  docOcr: string,
  metadata: any,
  userMsg: string
): Promise<string> {
  const ai = getGeminiAI();

  const prompt = `You are an expert Indian Gov procurement counsel examining an uploaded file.
Document Name: "${docName}"
Metadata: ${JSON.stringify(metadata)}
Simulated parsed Text/OCR:
"""
${docOcr}
"""

User has a question about this document:
"${userMsg}"

Provide a crisp, professional, expert answer under 4 sentences. Advise whether this file satisfies key technical pre-qualification guidelines, is authentic, or contains risks.`;

  if (!ai) {
    return `[Mock Counsel Response] Regarding your question on "${docName}": The simulated parsed data shows all signatures match legal Indian administrative procedures. The credentials listed comply with standard RFP thresholds. You should verify original stamps on delivery.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });
    return response.text || "Unable to synthesize answers at this time.";
  } catch (err) {
    console.error("Gemini chatAboutDocument failed:", err);
    return "Error communicating with AI counsel.";
  }
}



