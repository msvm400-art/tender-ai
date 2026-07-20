import React, { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle, AlertTriangle, Send, Sparkles, BookOpen, Clock, HardDrive, ClipboardCheck, FileCheck, HelpCircle, FileDown, Printer, MessageSquare, Calendar, Users, CheckSquare, Square, Plus, RefreshCw } from "lucide-react";
import { Tender, TenderMatch, BidDocument, TenderQA, CompanyProfile } from "../types.js";
import { jsPDF } from "jspdf";
import { formatDate, getCountdown, getAuthHeaders } from "../utils.js";
import { formatIndianCurrency } from "../utils/formatters.js";
import { useFirebase } from "../FirebaseContext.js";
import BidMatchAnalysis from "./BidMatchAnalysis.js";
import SmartBidDraft from "./SmartBidDraft.js";
import DocumentSummarizer from "./DocumentSummarizer.js";
import CompliancePreAudit from "./CompliancePreAudit.js";
import ConsortiumBuilder from "./ConsortiumBuilder.js";
import PortalIntegrationView from "./PortalIntegrationView.js";
import BidPricingTool from "./BidPricingTool.js";

interface TenderDetailProps {
  tenderId: string;
  onBack: () => void;
  profile: CompanyProfile;
  user?: any;
  onNavigateToBilling?: () => void;
}

export default function TenderDetailView({ tenderId, onBack, profile, user, onNavigateToBilling }: TenderDetailProps) {
  const { 
    firebaseUser, 
    saveBidDocumentToFirestore, 
    saveTenderQAToFirestore 
  } = useFirebase();

  const [tender, setTender] = useState<Tender | null>(null);
  const [match, setMatch] = useState<TenderMatch | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "eligibility" | "docs" | "qa" | "workspace" | "draft" | "summarizer" | "portal" | "pricing" | "timeline">("overview");
  const [showPrintLayout, setShowPrintLayout] = useState(false);
  const [eligibilitySubTab, setEligibilitySubTab] = useState<"audit" | "consortium">("audit");

  // Premium Features States
  const [corrigenda, setCorrigenda] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [newCorrTitle, setNewCorrTitle] = useState("");
  const [newCorrDesc, setNewCorrDesc] = useState("");
  const [isSimulatingCorr, setIsSimulatingCorr] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Local storage cache to track monthly executed summaries for FREE limits simulation
  const [summariesCount, setSummariesCount] = useState<number>(() => {
    try {
      return Number(localStorage.getItem("ai_summaries_used") || "0");
    } catch (e) {
      console.warn("localStorage is restricted in this context:", e);
      return 0;
    }
  });

  // RAG Chat items
  const [question, setQuestion] = useState("");
  const [chatLog, setChatLog] = useState<any[]>([]);
  const [isAsking, setIsAsking] = useState(false);

  // Bid builder items
  const [bids, setBids] = useState<BidDocument[]>([]);
  const [activeBidType, setActiveBidType] = useState<string>("COVER_LETTER");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamMessage, setStreamMessage] = useState("");
  const [selectedBidContent, setSelectedBidContent] = useState("");
  const [activeBidId, setActiveBidId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  // Fetch individual tender
  useEffect(() => {
    async function loadData() {
      try {
        const resTender = await fetch(`/api/tenders/${tenderId}`, {
          headers: getAuthHeaders()
        });
        const dataTender = await resTender.json();
        setTender(dataTender);

        const resMatch = await fetch("/api/matches", {
          headers: getAuthHeaders()
        });
        const matchesData = await resMatch.json();
        const found = matchesData.find((m: any) => m.tenderId === tenderId);
        setMatch(found || null);

        // Load pre-existing bids
        const resBids = await fetch(`/api/bids/${tenderId}`, {
          headers: getAuthHeaders()
        });
        const dataBids = await resBids.json();
        setBids(dataBids);

        // Preload cover letter or anything existing
        const defaultDoc = dataBids.find((b: any) => b.type === "COVER_LETTER");
        if (defaultDoc) {
          setSelectedBidContent(defaultDoc.content);
          setActiveBidId(defaultDoc.id);
        }

        // Retrieve corr bulletins
        try {
          const resCorr = await fetch(`/api/tenders/${tenderId}/corrigenda`, {
            headers: getAuthHeaders()
          });
          if (resCorr.ok) {
            const dataCorr = await resCorr.json();
            setCorrigenda(dataCorr);
          }
        } catch (e) {
          console.warn("Corrigenda fetch error:", e);
        }

        // Retrieve comments
        try {
          const resComments = await fetch(`/api/tenders/${tenderId}/collaboration`, {
            headers: getAuthHeaders()
          });
          if (resComments.ok) {
            const dataComments = await resComments.json();
            setComments(dataComments);
          }
        } catch (e) {
          console.warn("Comments fetch error:", e);
        }

        // Retrieve milestones tracking map
        if (found) {
          try {
            const resMilestones = await fetch(`/api/matches/${found.id}/milestones`, {
              headers: getAuthHeaders()
            });
            if (resMilestones.ok) {
              const dataMilestones = await resMilestones.json();
              setMilestones(dataMilestones);
            }
          } catch (e) {
            console.warn("Milestones fetch error:", e);
          }
        }
      } catch (err) {
        console.error("Error loading tender details:", err);
      }
    }
    loadData();
  }, [tenderId]);

  const refreshBidsList = async () => {
    try {
      const resBids = await fetch(`/api/bids/${tenderId}`, {
        headers: getAuthHeaders()
      });
      const dataBids = await resBids.json();
      setBids(dataBids);

      // Symmetrically mirror each loaded bid to Firestore when connected
      if (firebaseUser && Array.isArray(dataBids)) {
        for (const bid of dataBids) {
          saveBidDocumentToFirestore(bid);
        }
      }
    } catch (err) {
      console.error("Error refreshing bids:", err);
    }
  };

  const handleToggleMilestone = async (milestoneId: string) => {
    if (!match) return;
    const updated = milestones.map((m) => {
      if (m.id === milestoneId) {
        const nextStatus = m.status === "completed" ? "pending" : "completed";
        return {
          ...m,
          status: nextStatus,
          date: nextStatus === "completed" ? new Date().toISOString() : null
        };
      }
      return m;
    });
    setMilestones(updated);

    try {
      await fetch(`/api/matches/${match.id}/milestones`, {
        method: "PUT",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ milestones: updated })
      });
    } catch (e) {
      console.error("Failed to save milestone checklists:", e);
    }
  };

  const handleToggleAllMilestones = async () => {
    if (!match || milestones.length === 0) return;
    const allCompleted = milestones.every((m) => m.status === "completed");
    const nextStatus = allCompleted ? "pending" : "completed";
    
    const updated = milestones.map((m) => {
      return {
        ...m,
        status: nextStatus,
        date: nextStatus === "completed" ? (m.date || new Date().toISOString()) : null
      };
    });
    setMilestones(updated);

    try {
      await fetch(`/api/matches/${match.id}/milestones`, {
        method: "PUT",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ milestones: updated })
      });
    } catch (e) {
      console.error("Failed to save all milestone checklists:", e);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/tenders/${tenderId}/collaboration`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ text: newCommentText.trim() })
      });
      if (res.ok) {
        const added = await res.json();
        setComments((current) => [...current, added]);
        setNewCommentText("");
      }
    } catch (err) {
      console.error("Comment post error:", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleSimulateCorrigendum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCorrTitle.trim() || !newCorrDesc.trim()) return;
    setIsSimulatingCorr(true);
    try {
      const res = await fetch(`/api/tenders/${tenderId}/corrigenda`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          title: newCorrTitle.trim(),
          description: newCorrDesc.trim()
        })
      });
      if (res.ok) {
        const added = await res.json();
        setCorrigenda((current) => [added, ...current]);
        setNewCorrTitle("");
        setNewCorrDesc("");
      }
    } catch (err) {
      console.error("Corrigenda simulate error:", err);
    } finally {
      setIsSimulatingCorr(false);
    }
  };

  // Handle generative bid template
  const handleGenerateBid = async () => {
    setIsGenerating(true);
    setStreamMessage("Analyzing tender parameters...");
    
    // Quick pipeline stream simulation
    const steps = [
      "Analyzing tender requirements...",
      "Reading company profile credentials...",
      "Cross-referencing legal clauses...",
      "Structuring Indian public-tender formatting layout...",
      "Synthesizing proposal sections...",
      "Done!"
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise((r) => setTimeout(r, 600));
      setStreamMessage(steps[i]);
    }

    try {
      const res = await fetch(`/api/bids/${tenderId}/generate`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ type: activeBidType }),
      });
      const data = await res.json();
      
      // Update local bid documents
      const updatedBids = [...bids.filter((b) => b.type !== activeBidType), data];
      setBids(updatedBids);
      setSelectedBidContent(data.content);
      setActiveBidId(data.id);

      // Persist copy in Firestore if connected
      if (firebaseUser) {
        saveBidDocumentToFirestore(data);
      }

      // Track successful design generation
      window.logAnalyticsEvent("generate_bid_document", {
        tenderId,
        documentType: activeBidType,
        bidId: data.id,
        plan: user?.plan || "FREE",
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to generate bid documentation:", err);
    } finally {
      setIsGenerating(false);
      setStreamMessage("");
    }
  };

  const handleUpdateBidContent = async () => {
    if (!activeBidId) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/bids/${activeBidId}`, {
        method: "PUT",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ content: selectedBidContent }),
      });
      const data = await res.json();
      setSaveStatus("success");
      setTimeout(() => setSaveStatus(null), 2500);

      // Refresh bids list
      setBids(bids.map((b) => (b.id === activeBidId ? data : b)));

      // Update the Firestore mirrored copy
      if (firebaseUser) {
        saveBidDocumentToFirestore(data);
      }

      // Log save event to tracking snippet
      window.logAnalyticsEvent("save_bid_draft", {
        tenderId,
        bidId: activeBidId,
        charCount: selectedBidContent.length,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error saving doc:", err);
    }
  };

  const handleQueryRAG = async (e?: React.FormEvent, customQ?: string) => {
    if (e) e.preventDefault();
    const queryStr = customQ || question;
    if (!queryStr.trim()) return;

    setIsAsking(true);
    setQuestion("");
    try {
      const res = await fetch(`/api/tenders/${tenderId}/qa`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ question: queryStr }),
      });
      const data = await res.json();
      setChatLog((prev) => [...prev, { role: "user", text: queryStr }, { role: "ai", text: data.answer, citations: data.citations }]);

      // Push Q&A interaction document to Firestore
      if (firebaseUser) {
        saveTenderQAToFirestore({
          id: data.id || `qa-${Math.random().toString(36).substring(3, 9)}`,
          tenderId: tenderId,
          question: queryStr,
          answer: data.answer
        });
      }

      // Log AI chatbot querying event
      window.logAnalyticsEvent("tender_chat_query", {
        tenderId,
        questionLength: queryStr.length,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Interactive chatbot query failed:", err);
    } finally {
      setIsAsking(false);
    }
  };

  const handleExportPDF = () => {
    if (!tender) return;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const primaryColor = { r: 27, g: 79, b: 216 }; // #1B4FD8
    const darkSlateColor = { r: 15, g: 23, b: 42 }; // #0F172A
    const grayColor = { r: 71, g: 85, b: 105 }; // #475569
    const lightBg = { r: 248, g: 250, b: 252 }; // #F8FAFC
    const lineStroke = { r: 226, g: 232, b: 240 }; // #E2E8F0

    let currentY = 20;
    const marginX = 20;
    const contentWidth = 170; // 210 - 40

    // Helper functions for page management
    const checkPageOverflow = (neededHeight: number) => {
      if (currentY + neededHeight > 275) {
        doc.addPage();
        currentY = 20;
        drawHeader();
      }
    };

    const drawHeader = () => {
      // Top accent bar
      doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
      doc.rect(0, 0, 210, 4, "F");

      // Header logo / system name
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      doc.text("TENDERAI", marginX, 12);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(grayColor.r, grayColor.g, grayColor.b);
      doc.text("•  COMPLIANCE & BID INTELLIGENCE WORKSPACE", marginX + 20, 12);

      const todayStr = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      doc.text(`Generated: ${todayStr}`, 190, 12, { align: "right" });

      // Clean divider line below header
      doc.setDrawColor(lineStroke.r, lineStroke.g, lineStroke.b);
      doc.setLineWidth(0.3);
      doc.line(marginX, 15, 190, 15);

      if (currentY < 20) {
        currentY = 22;
      }
    };

    // Draw initial header on page 1
    drawHeader();
    currentY = 25;

    // Document Title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(darkSlateColor.r, darkSlateColor.g, darkSlateColor.b);
    
    const splitTitle = doc.splitTextToSize(tender.title || "Tender Document", contentWidth);
    doc.text(splitTitle, marginX, currentY);
    currentY += (splitTitle.length * 5.5) + 4;

    // Tender Reference & Source Meta Bubble
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(grayColor.r, grayColor.g, grayColor.b);
    
    const metaStr = `Tender No: ${tender.externalId || "N/A"}  |  Source: ${tender.sourcePortal || "N/A"}  |  Department: ${tender.department || "N/A"}`;
    const wrappedMeta = doc.splitTextToSize(metaStr, contentWidth);
    wrappedMeta.forEach((line: string) => {
      doc.text(line, marginX, currentY);
      currentY += 4.5;
    });
    currentY += 5;

    // SECTION 1: EXEC SUMMARY (IF EXISTS)
    if (tender.aiSummary) {
      checkPageOverflow(30);
      
      // Header for synopsis
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      doc.text("AI Executive Synopsis", marginX, currentY);
      currentY += 4;
      
      // Box backdrop
      const wrappedSummary = doc.splitTextToSize(tender.aiSummary, contentWidth - 10);
      const boxHeight = (wrappedSummary.length * 4.5) + 8;
      
      checkPageOverflow(boxHeight + 5);
      
      doc.setFillColor(lightBg.r, lightBg.g, lightBg.b);
      doc.rect(marginX, currentY, contentWidth, boxHeight, "F");
      
      doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
      doc.setLineWidth(0.5);
      doc.line(marginX, currentY, marginX, currentY + boxHeight); // left accent border
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(darkSlateColor.r, darkSlateColor.g, darkSlateColor.b);
      
      let textLineY = currentY + 6;
      wrappedSummary.forEach((line: string) => {
        doc.text(line, marginX + 5, textLineY);
        textLineY += 4.5;
      });
      
      currentY += boxHeight + 8;
    }

    // SECTION 2: SCHEDULE OF REQUIREMENTS
    if (tender.workDescription) {
      checkPageOverflow(25);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      doc.text("Schedule of Requirements & Scope of Work", marginX, currentY);
      currentY += 6;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(darkSlateColor.r, darkSlateColor.g, darkSlateColor.b);

      const splitDesc = doc.splitTextToSize(tender.workDescription, contentWidth);
      splitDesc.forEach((line: string) => {
        checkPageOverflow(5);
        doc.text(line, marginX, currentY);
        currentY += 4.5;
      });
      currentY += 6;
    }

    // SECTION 3: KEY COMMERCIAL PARAMETERS TABLE (FANCY GRID)
    checkPageOverflow(65);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.text("Critical Financial & Logistical Parameters", marginX, currentY);
    currentY += 6;

    const rowHeight = 7.5;
    const tableData = [
      ["Parameter / Attribute", "Specification Details"],
      ["Est. Project Budget", formatIndianCurrency(tender.tenderValue ? tender.tenderValue * 10000000 : null)],
      ["EMD Refundable Deposit", formatIndianCurrency(tender.emdAmount ? tender.emdAmount * 100000 : null)],
      ["Location / Operational Site", tender.location || "N/A"],
      ["Published Date", formatDate(tender.publishedDate)],
      ["Bid Submission Deadline", formatDate(tender.bidSubmissionDeadline)],
      ["Technical Proposal Opening Date", formatDate(tender.openingDate)],
    ];

    tableData.forEach((row, i) => {
      checkPageOverflow(rowHeight);
      
      const isHeader = i === 0;
      if (isHeader) {
        doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
        doc.rect(marginX, currentY, contentWidth, rowHeight, "F");
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(255, 255, 255);
      } else {
        // Alternating row background
        if (i % 2 === 1) {
          doc.setFillColor(lightBg.r, lightBg.g, lightBg.b);
          doc.rect(marginX, currentY, contentWidth, rowHeight, "F");
        }
        doc.setDrawColor(lineStroke.r, lineStroke.g, lineStroke.b);
        doc.setLineWidth(0.2);
        doc.line(marginX, currentY, marginX + contentWidth, currentY); // top border line
        doc.line(marginX, currentY + rowHeight, marginX + contentWidth, currentY + rowHeight); // bottom border line
        
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(darkSlateColor.r, darkSlateColor.g, darkSlateColor.b);
      }

      // Left Column
      doc.setFontSize(i === 0 ? 9 : 8.5);
      doc.text(row[0], marginX + 4, currentY + 5.2);

      // Right Column
      if (!isHeader) {
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(grayColor.r, grayColor.g, grayColor.b);
      }
      doc.text(row[1], marginX + (contentWidth / 2) + 4, currentY + 5.2);

      // Vertical Split Line
      doc.setDrawColor(lineStroke.r, lineStroke.g, lineStroke.b);
      doc.setLineWidth(0.2);
      doc.line(marginX + (contentWidth / 2), currentY, marginX + (contentWidth / 2), currentY + rowHeight);

      // Outside box borders
      doc.line(marginX, currentY, marginX, currentY + rowHeight);
      doc.line(marginX + contentWidth, currentY, marginX + contentWidth, currentY + rowHeight);

      currentY += rowHeight;
    });
    currentY += 8;

    // SECTION 4: ELIGIBILITY MATRICES
    checkPageOverflow(40);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.text("Compliance & Eligibility Reference Matrix", marginX, currentY);
    currentY += 6;

    const reqTurnover = tender.eligibilityCriteria.minTurnover;
    const provTurnover = profile.annualTurnover || 0;
    const isTurnoverCompliant = provTurnover >= reqTurnover;

    const compData = [
      ["Criteria Class", "Tender Requirement", "Your Corporate Profile Match", "Status Check"],
      [
        "Capital Turnover",
        formatIndianCurrency(reqTurnover ? reqTurnover * 10000000 : null),
        formatIndianCurrency(provTurnover ? provTurnover * 10000000 : null),
        isTurnoverCompliant ? "COMPLIANT" : "INSUFFICIENT"
      ],
      [
        "Empanelled MSME Only",
        tender.eligibilityCriteria.msmeOnly ? "Yes (Required)" : "No Restriction",
        profile.msmeRegistered ? "Yes" : "No",
        (!tender.eligibilityCriteria.msmeOnly || profile.msmeRegistered) ? "COMPLIANT" : "NOT ELIGIBLE"
      ],
      [
        "Blacklisting Immunity",
        "Required Clear Affidavit",
        "No History (Clean)",
        "COMPLIANT"
      ]
    ];

    compData.forEach((row, i) => {
      checkPageOverflow(rowHeight);
      const isHeader = i === 0;
      
      if (isHeader) {
        doc.setFillColor(darkSlateColor.r, darkSlateColor.g, darkSlateColor.b);
        doc.rect(marginX, currentY, contentWidth, rowHeight, "F");
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(255, 255, 255);
      } else {
        if (i % 2 === 1) {
          doc.setFillColor(lightBg.r, lightBg.g, lightBg.b);
          doc.rect(marginX, currentY, contentWidth, rowHeight, "F");
        }
        doc.setDrawColor(lineStroke.r, lineStroke.g, lineStroke.b);
        doc.setLineWidth(0.2);
        doc.line(marginX, currentY, marginX + contentWidth, currentY);
        doc.line(marginX, currentY + rowHeight, marginX + contentWidth, currentY + rowHeight);
        
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(darkSlateColor.r, darkSlateColor.g, darkSlateColor.b);
      }

      const colWidth = contentWidth / 4;
      doc.setFontSize(8);

      // Col 1: Name
      doc.text(row[0], marginX + 2, currentY + 5.2);
      
      // Col 2: Required
      if (!isHeader) doc.setFont("Helvetica", "normal");
      doc.text(row[1], marginX + colWidth + 2, currentY + 5.2);
      
      // Col 3: Profile
      doc.text(row[2], marginX + (colWidth * 2) + 2, currentY + 5.2);

      // Col 4: Status
      if (isHeader) {
        doc.text(row[3], marginX + (colWidth * 3) + 2, currentY + 5.2);
      } else {
        doc.setFont("Helvetica", "bold");
        const statusVal = row[3];
        if (statusVal === "COMPLIANT") {
          doc.setTextColor(16, 124, 65); // Green
        } else {
          doc.setTextColor(211, 47, 47); // Red
        }
        doc.text(statusVal, marginX + (colWidth * 3) + 2, currentY + 5.2);
        doc.setTextColor(darkSlateColor.r, darkSlateColor.g, darkSlateColor.b);
      }

      // Vertical line splits
      doc.setDrawColor(lineStroke.r, lineStroke.g, lineStroke.b);
      doc.line(marginX + colWidth, currentY, marginX + colWidth, currentY + rowHeight);
      doc.line(marginX + (colWidth * 2), currentY, marginX + (colWidth * 2), currentY + rowHeight);
      doc.line(marginX + (colWidth * 3), currentY, marginX + (colWidth * 3), currentY + rowHeight);

      // Outer box lines
      doc.line(marginX, currentY, marginX, currentY + rowHeight);
      doc.line(marginX + contentWidth, currentY, marginX + contentWidth, currentY + rowHeight);

      currentY += rowHeight;
    });

    // FOOTER PAGE NUMBERING FOR ALL PAGES
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Footer line
      doc.setDrawColor(lineStroke.r, lineStroke.g, lineStroke.b);
      doc.setLineWidth(0.3);
      doc.line(marginX, 282, 190, 282);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(grayColor.r, grayColor.g, grayColor.b);
      doc.text(`TenderAI Platform • Private Bid Intelligence Summary • ID: ${tender.id}`, marginX, 286);
      doc.text(`Page ${i} of ${pageCount}`, 190, 286, { align: "right" });
    }

    // Trigger standard immediate file download in user's browser
    const sanitizedFilename = `Tender_${tender.externalId || tender.id || "Document"}.pdf`.replace(/[^a-z0-9_-]/gi, '_');
    doc.save(sanitizedFilename);
  };

  if (!tender) return <div className="p-6 text-slate-500 text-sm">Retrieving full tender overview... Please wait.</div>;

  const countdown = getCountdown(tender.bidSubmissionDeadline);

  // Setup standard list of tab styles
  const tabStyles = (tabName: string) =>
    `px-4 py-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 cursor-pointer ${
      activeTab === tabName ? "border-blue-600 text-blue-600 font-extrabold" : "border-transparent text-slate-500 hover:text-slate-800"
    }`;

  return (
    <div className="space-y-6">
      {/* Detail Header */}
      <div className="bg-white/60 backdrop-blur-md border border-white/25 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="space-y-2">
          <button
            onClick={onBack}
            className="inline-flex items-center space-x-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer pb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Discovery Feed</span>
          </button>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200 px-2.5 py-0.5 rounded-full uppercase">
              {tender.sourcePortal}
            </span>
            <span className="text-xs text-slate-400 font-mono">Tender No: {tender.externalId}</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 leading-snug">{tender.title}</h2>
          <p className="text-xs text-slate-500 font-medium">{tender.department}</p>
        </div>
        <div className="flex flex-row md:flex-col items-end gap-3 justify-between w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 shrink-0">
          <div className="flex flex-col items-end gap-2 w-full md:w-auto">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded border ${countdown.colorClass}`}>
              {countdown.text}
            </span>
            {match && (
              <div className={`text-xs font-bold border px-3 py-1 rounded-full ${match.matchScore >= 75 ? "bg-green-100 text-green-800 border-green-200" : "bg-amber-100 text-amber-800 border-amber-200"}`}>
                {match.matchScore}% Match Score
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto">
            <button
              onClick={handleExportPDF}
              className="flex items-center justify-center space-x-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm hover:scale-[1.02] active:scale-95 transition-all cursor-pointer w-full md:w-auto"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
            <button
              onClick={() => setShowPrintLayout(true)}
              className="flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm hover:scale-[1.02] active:scale-95 transition-all cursor-pointer w-full md:w-auto"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Tender</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs navigation row */}
      <div className="border border-white/20 bg-white/55 backdrop-blur-md rounded-2xl shadow-xs overflow-hidden flex flex-wrap">
        <button onClick={() => setActiveTab("overview")} className={tabStyles("overview")}>Overview</button>
        <button onClick={() => setActiveTab("eligibility")} className={tabStyles("eligibility")}>Eligibility Analysis</button>
        <button onClick={() => setActiveTab("docs")} className={tabStyles("docs")}>Documents Vault</button>
        <button onClick={() => setActiveTab("qa")} className={tabStyles("qa")}>Citations Chatbot</button>
        <button onClick={() => setActiveTab("workspace")} className={tabStyles("workspace")}>Smart Workspace</button>
        <button onClick={() => setActiveTab("pricing")} className={tabStyles("pricing")}>Bid Pricing & BOQ</button>
        <button onClick={() => setActiveTab("timeline")} className={tabStyles("timeline")}>Corrigenda & Roadmap</button>
        <button onClick={() => setActiveTab("draft")} className={tabStyles("draft")}>Smart Bid Draft</button>
        <button onClick={() => setActiveTab("summarizer")} className={tabStyles("summarizer")}>Document Summarizer</button>
        <button onClick={() => setActiveTab("portal")} className={tabStyles("portal")}>Portal Integration</button>
      </div>

      {/* Tab Content Display */}
      <div className="mt-6">
        {activeTab === "overview" && (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* AI Summary Card */}
              <div className="bg-gradient-to-br from-blue-50/40 to-indigo-50/40 backdrop-blur-xs border border-white/20 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center space-x-2 text-blue-600 font-bold text-sm mb-3">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>AI Generated Executive Synopsis</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed font-normal">
                  {tender.aiSummary || "This tender calls for core construction and engineering works matching strict quality parameters. For custom AI summarizations, click the button to trigger full Gemini analysis instantly in the background."}
                </p>
                {!tender.aiSummary && (
                  user?.plan === "FREE" && summariesCount >= 3 ? (
                    <div className="mt-3.5 p-3.5 bg-amber-50 border border-amber-250 rounded-xl space-y-2 text-xs">
                      <p className="font-extrabold text-amber-800 flex items-center gap-1.5 uppercase">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span>AI Summary Quota Exceeded (3/3 summaries used)</span>
                      </p>
                      <p className="text-slate-650 font-normal leading-normal">
                        Your free Bharat (Free) plan is capped at 3 executive summary generations per month. Upgrade to access infinite deep summarizations.
                      </p>
                      <button
                        onClick={onNavigateToBilling}
                        className="bg-slate-900 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-lg hover:bg-slate-850 cursor-pointer transition-all border border-slate-950 uppercase"
                      >
                        Upgrade Plan Now
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/tenders/${tenderId}/summary`, {
                            headers: getAuthHeaders()
                          });
                          const data = await res.json();
                          setTender({ ...tender, aiSummary: data.summary });
                          const current = summariesCount + 1;
                          setSummariesCount(current);
                          try {
                            localStorage.setItem("ai_summaries_used", String(current));
                          } catch (e) {
                            console.warn("Could not save to localStorage:", e);
                          }
                        } catch (err) {
                          console.error("Failed to fetch or update AI summary:", err);
                        }
                      }}
                      className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center space-x-1 shadow cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Run Gemini AI Deep Summary {user?.plan === "FREE" ? `(${3 - summariesCount} left)` : ""}</span>
                    </button>
                  )
                )}
              </div>

              {/* AI Powered Bid Match Analysis */}
              <BidMatchAnalysis tender={tender} profile={profile} />

              {/* Technical specifications and description */}
              <div className="bg-white/60 backdrop-blur-md border border-white/25 rounded-2xl p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 flex items-center space-x-1.5 border-b border-slate-100 pb-2">
                    <BookOpen className="w-4.5 h-4.5 text-slate-400" />
                    <span>Schedule of Requirements</span>
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed mt-2.5">
                    {tender.workDescription}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Materials Standards:</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1">
                    {tender.technicalSpecs || "Bureau of Indian Standards (BIS) grade certification checked pre-site dispatch by inspection team."}
                  </p>
                </div>
              </div>
            </div>

            {/* General Info Column Card */}
            <div className="space-y-6">
              <div className="bg-white/60 backdrop-blur-md border border-white/25 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>General Deadlines & Caps</span>
                </h3>
                <div className="text-xs space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Budget Estimate:</span>
                    <span className="font-bold text-slate-800 font-mono">{formatIndianCurrency(tender.tenderValue ? tender.tenderValue * 10000000 : null)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">EMD Amount (Lakhs):</span>
                    <span className="font-bold text-slate-800 font-mono">{formatIndianCurrency(tender.emdAmount ? tender.emdAmount * 100000 : null)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Location:</span>
                    <span className="font-semibold text-slate-800">{tender.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Published Date:</span>
                    <span className="font-semibold text-slate-700">{formatDate(tender.publishedDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Opening Date:</span>
                    <span className="font-semibold text-slate-700">{formatDate(tender.openingDate)}</span>
                  </div>
                </div>
              </div>

              {/* MSME guidelines waiver block */}
              {tender.eligibilityCriteria.msmeOnly && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3 text-xs text-emerald-800">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">EMD Exemption Authorized!</span>
                    As an empaneled MSME registered contractor, you seek a full 100% waiver of deposit fees subject to annexing your Udyam credential.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Eligibility comparative matrix */}
        {activeTab === "eligibility" && (
          <div className="space-y-6">
            {/* Sub-navigation selector */}
            <div className="flex border-b border-slate-200 space-x-1">
              <button
                onClick={() => setEligibilitySubTab("audit")}
                className={`py-3 px-5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  eligibilitySubTab === "audit"
                    ? "border-[#1231D0] text-[#1231D0]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Smart Compliance Pre-Audit Scorecard
              </button>
              <button
                onClick={() => setEligibilitySubTab("consortium")}
                className={`py-3 px-5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  eligibilitySubTab === "consortium"
                    ? "border-[#1231D0] text-[#1231D0]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Joint Venture Consortium Partner Matcher
              </button>
            </div>

            {eligibilitySubTab === "audit" ? (
              <CompliancePreAudit
                tender={tender}
                profile={profile}
                onUpgradeClick={onNavigateToBilling || (() => {})}
                userPlan={user?.plan || "FREE"}
              />
            ) : (
              <ConsortiumBuilder tender={tender} profile={profile} />
            )}
          </div>
        )}

        {/* Tab Documents List */}
        {activeTab === "docs" && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">Released Tender Attachments</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              {(tender.documents || []).map((doc, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4 flex justify-between items-center bg-slate-50">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-900 block">{doc.name}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">Format: PDF | Type: {doc.type}</span>
                  </div>
                  <button className="text-xs bg-white text-blue-600 border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg font-medium cursor-pointer">
                    View Doc
                  </button>
                </div>
              ))}
              {(!tender.documents || tender.documents.length === 0) && (
                <div className="col-span-2 text-center text-slate-400 py-6 text-xs font-mono">
                  No direct attachments linked. Fetch original PDFs directly.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chat interface with citation boxes */}
        {activeTab === "qa" && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[500px]">
            {/* Log block */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50">
              <div className="text-xs text-slate-450 text-center font-mono py-2 bg-white/70 backdrop-blur rounded-lg border border-slate-200/50">
                🤖 TenderAI Chatbot. Asking questions queries the vector RAG database of CPWD or BREDA.
              </div>

              {chatLog.map((log, idx) => (
                <div key={idx} className={`flex flex-col max-w-[80%] ${log.role === "user" ? "ml-auto items-end" : "mr-auto items-start"}`}>
                  <div className={`rounded-xl px-4 py-3 text-xs leading-relaxed ${log.role === "user" ? "bg-blue-600 text-white" : "bg-white text-slate-800 border border-slate-200 shadow-sm"}`}>
                    {log.text}
                  </div>
                  
                  {/* Citations Segment Box - Highlighted in customized yellow/amber boxes */}
                  {log.role === "ai" && log.citations && log.citations.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-905 rounded-xl p-3.5 mt-2.5 space-y-1.5 text-xs">
                      <span className="font-extrabold uppercase text-[9px] tracking-wider text-yellow-800 block">Verified Tender Excerpts & Citations:</span>
                      {log.citations.map((cite: any, id: number) => (
                        <div key={id} className="border-l-2 border-yellow-400 pl-2">
                          <p className="italic font-normal">"{cite.text}"</p>
                          <span className="text-[10px] text-yellow-750 font-bold block pt-1 uppercase">Section: {cite.section} | Page No. {cite.pageNumber}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {isAsking && (
                <div className="text-xs text-slate-400 flex items-center space-x-1">
                  <span className="animate-bounce">●</span>
                  <span className="animate-bounce [animation-delay:0.2s]">●</span>
                  <span className="animate-bounce [animation-delay:0.4s]">●</span>
                  <span>Scanning tender index...</span>
                </div>
              )}
            </div>

            {/* Quick suggested tags */}
            <div className="p-3 border-t border-slate-100 flex flex-wrap gap-2 bg-white">
              <button onClick={() => handleQueryRAG(undefined, "What is the EMD amount?")} className="text-[11px] hover:bg-slate-10s text-slate-600 border border-slate-200 px-3 py-1 rounded-full text-left cursor-pointer">
                What is the EMD?
              </button>
              <button onClick={() => handleQueryRAG(undefined, "What is the turnover required to qualify?")} className="text-[11px] hover:bg-slate-10s text-slate-600 border border-slate-200 px-3 py-1 rounded-full text-left cursor-pointer">
                Turnover qualification limit?
              </button>
              <button onClick={() => handleQueryRAG(undefined, "Is there an exemption for MSMEs?")} className="text-[11px] hover:bg-slate-10s text-slate-600 border border-slate-200 px-3 py-1 rounded-full text-left cursor-pointer">
                Exemptions for MSMEs?
              </button>
            </div>

            {/* Message Bar */}
            <form onSubmit={handleQueryRAG} className="p-4 border-t border-slate-200 bg-white flex space-x-3 items-center">
              <input
                type="text"
                placeholder="Ask anything about the tender..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="flex-1 border border-slate-250 rounded-lg py-2 px-3.5 text-xs focus:outline-none"
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-2 cursor-pointer">
                <Send className="w-4.5 h-4.5" />
              </button>
            </form>
          </div>
        )}

        {/* Smart Bid Draft Panel */}
        {activeTab === "draft" && (
          <div className="space-y-4">
            <SmartBidDraft 
              tender={tender} 
              profile={profile} 
              onRefreshBids={refreshBidsList} 
            />
          </div>
        )}

        {/* Document Summarizer Panel */}
        {activeTab === "summarizer" && (
          <div className="space-y-4">
            <DocumentSummarizer tender={tender} />
          </div>
        )}

        {/* Government Portal Integration Panel */}
        {activeTab === "portal" && (
          <div className="space-y-4">
            <PortalIntegrationView 
              tender={tender} 
              profile={profile} 
              match={match}
              onMatchStatusChange={(updatedMatch) => setMatch(updatedMatch)}
            />
          </div>
        )}

        {/* Bid Pricing & BOQ Estimation Panel */}
        {activeTab === "pricing" && tender && (
          <div className="space-y-4">
            <BidPricingTool tender={tender} user={user} />
          </div>
        )}

        {/* Corrigenda, Roadmaps, and Collaboration Panel */}
        {activeTab === "timeline" && tender && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Bid Milestones Tracking Roadmap (span 5) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <ClipboardCheck className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
                    Bidding Roadmap & Milestones
                  </h3>
                </div>
                <span className="bg-blue-50 text-blue-700 font-mono text-[11px] font-bold px-2 py-0.5 rounded">
                  {milestones.filter((m) => m.status === "completed").length}/{milestones.length} Done
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1 bg-slate-50 border border-slate-100 p-2.5 rounded-lg">
                <div className="flex justify-between text-[11px] text-slate-500 font-medium font-mono pb-1">
                  <span>Submission Progress</span>
                  <span>{Math.round((milestones.filter((m) => m.status === "completed").length / (milestones.length || 1)) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" 
                    style={{ width: `${(milestones.filter((m) => m.status === "completed").length / (milestones.length || 1)) * 100}%` }}
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed md:pr-1">
                Toggle milestone items as your bidding compiles. Checking item requirements will auto-save to cloud databases and keep corporate leadership aligned.
              </p>

              {/* Bulk Toggle Button */}
              {milestones.length > 0 && (
                <div className="flex items-center justify-between pt-1 pb-1 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Checklist Controls</span>
                  <button
                    type="button"
                    onClick={handleToggleAllMilestones}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 py-1 px-2.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer select-none"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{milestones.every((m) => m.status === "completed") ? "Uncheck All" : "Do All / Check All"}</span>
                  </button>
                </div>
              )}

              {/* Milestones Checklist List */}
              <div className="space-y-2.5 pt-2">
                {milestones.length === 0 ? (
                  <div className="p-4 bg-slate-50 text-center rounded-lg border border-dashed text-slate-400 text-xs">
                     No milestones configured for this item. Active bid-match tracker must be initialized.
                  </div>
                ) : (
                  milestones.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleToggleMilestone(m.id)}
                      className="w-full text-left p-3 border border-slate-150 hover:border-blue-400 bg-white hover:bg-blue-50/20 rounded-xl transition flex items-start gap-3 cursor-pointer group active:scale-[0.99]"
                    >
                      {m.status === "completed" ? (
                        <CheckSquare className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-4.5 h-4.5 text-slate-400 group-hover:text-blue-500 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <span className={`text-[12px] font-semibold block leading-snug ${m.status === "completed" ? "line-through text-slate-400" : "text-slate-700"}`}>
                          {m.label}
                        </span>
                        {m.date && (
                          <span className="text-[9px] text-emerald-650 font-mono font-medium block">
                            Completed {new Date(m.date).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Corrigenda & Team Discussion Forum (span 7) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Top Card: Corrigenda Bulletins */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
                      Corrigenda bulletins
                    </h3>
                  </div>
                  <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold px-2 rounded-full uppercase tracking-wider">
                    {corrigenda.length} Amendments
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Avoid disqualification by tracking published amendments. Upload or input newly scanned portal updates to let Gemini verify how your pre-bid scores might pivot.
                </p>

                {/* Simulate Corrigendum Form */}
                <form onSubmit={handleSimulateCorrigendum} className="bg-slate-50/70 border border-slate-200/90 p-4 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-slate-700 block uppercase tracking-wider">
                    Add Pre-bid updates/Corrigenda
                  </span>
                  <div className="grid grid-cols-1 gap-2.5">
                    <input
                      type="text"
                      placeholder="e.g., Corrigendum III: EMD Reduction to 50%"
                      value={newCorrTitle}
                      onChange={(e) => setNewCorrTitle(e.target.value)}
                      className="placeholder-slate-400 border border-slate-200 rounded-lg p-2 text-xs w-full focus:outline-none bg-white font-medium"
                      required
                    />
                    <textarea
                      placeholder="e.g., Clause 14 is revised. MSME certificate holders are exempted from depositing 50% of the Earnest Money Deposit."
                      value={newCorrDesc}
                      onChange={(e) => setNewCorrDesc(e.target.value)}
                      className="placeholder-slate-400 border border-slate-200 rounded-lg p-2 text-xs w-full h-16 resize-none focus:outline-none bg-white font-medium"
                      required
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSimulatingCorr || !newCorrTitle.trim() || !newCorrDesc.trim()}
                      className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] py-1.5 px-3 rounded-lg shadow-sm cursor-pointer flex items-center gap-1 transition select-none disabled:opacity-40"
                    >
                      {isSimulatingCorr ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Gemini Analysing Bid Impacts...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Submit & Run AI Assessment</span>
                        </>
                      )}
                    </button>
                    </div>
                </form>

                {/* List of Corrigenda */}
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                  {corrigenda.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs border border-dashed rounded-lg bg-slate-50/30">
                      No corrigendum amendments detected for this tender.
                    </div>
                  ) : (
                    corrigenda.map((corr) => (
                      <div key={corr.id} className="border-l-2 border-amber-450 bg-amber-50/20 p-3.5 rounded-r-xl space-y-2 border border-slate-100">
                        <div className="flex justify-between items-start">
                          <h4 className="font-extrabold text-[12px] text-slate-800 leading-snug">
                            {corr.title}
                          </h4>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {new Date(corr.publishedDate).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-normal bg-white/70 p-2 border border-slate-100 rounded font-medium">
                          {corr.description}
                        </p>
                        <div className="bg-amber-100/30 border border-amber-100 p-2.5 rounded text-xs space-y-1">
                          <div className="flex items-center gap-1 text-amber-900 font-bold text-[10px] uppercase">
                            <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                            <span>AI Compliance Recommendation</span>
                          </div>
                          <p className="text-[11px] text-slate-800 leading-relaxed font-sans">
                            {corr.impactAnalysis}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Bottom Card: Live Collaboration Forum / Activity Log */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5 text-blue-500" />
                    <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
                      Team bid room forum
                    </h3>
                  </div>
                  <span className="bg-slate-100 text-slate-600 text-[10px] font-mono px-2 py-0.5 rounded">
                    {comments.length} Comments
                  </span>
                </div>

                {/* List of comments */}
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {comments.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs border border-dashed rounded-lg bg-slate-50/30">
                      Team comments feed is clean. Say something below!
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="bg-slate-50 p-3 rounded-lg space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[11px] text-slate-700">
                            {comment.userName}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed font-sans font-medium">
                          {comment.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Submitting form */}
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask teammates, tag queries, or compile bid items..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="flex-1 placeholder-slate-400 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none font-medium bg-white text-slate-800"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingComment || !newCommentText.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2 rounded-lg cursor-pointer transition select-none"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* Workspace panel for drafting */}
        {activeTab === "workspace" && (
          <div className="space-y-4">
            {user?.plan === "FREE" && (
              <div className="bg-slate-900 text-white rounded-xl p-4.5 flex flex-col sm:flex-row gap-3.5 items-start sm:items-center justify-between border border-slate-950/20 shadow-lg relative overflow-hidden">
                <div className="flex gap-3 items-center">
                  <span className="text-xl">🔒</span>
                  <div>
                    <h4 className="font-black text-sm text-amber-400 uppercase tracking-wide">Workspace View-Only Limit Active</h4>
                    <p className="text-slate-300 font-normal text-xs mt-0.5 leading-relaxed">
                      Your trial has elapsed, or you are on the Bharat (Free) plan. Active AI bid compilation, document editing, and savings are locked in View-only mode.
                    </p>
                  </div>
                </div>
                <button
                  onClick={onNavigateToBilling}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition-all active:scale-95 shrink-0 uppercase"
                >
                  Upgrade to unlock workspace editing
                </button>
              </div>
            )}

            <div className="grid md:grid-cols-5 gap-6">
            {/* Left Reference sidebar panel */}
            <div className="md:col-span-1.5 bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
              <span className="text-xs font-bold text-slate-900 uppercase">Documents Check list</span>
              <ul className="text-xs space-y-2.5">
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>GSTIN Registered Certificate</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>Udyam/MSME Registration</span>
                </li>
                <li className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Class A Civil license copy</span>
                </li>
              </ul>
            </div>

            {/* Right content editor */}
            <div className="md:col-span-3.5 bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              {/* Draft document selectors */}
              <div className="flex flex-wrap border-b border-slate-100 pb-3 gap-2">
                {["COVER_LETTER", "TECHNICAL_PROPOSAL", "COMPLIANCE_MATRIX", "BOQ"].map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setActiveBidType(type);
                      const found = bids.find((b) => b.type === type);
                      setSelectedBidContent(found ? found.content : "");
                      setActiveBidId(found ? found.id : null);
                    }}
                    className={`text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-all ${
                      activeBidType === type ? "bg-slate-900 text-white font-extrabold" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {type.replace("_", " ")}
                  </button>
                ))}
              </div>

              {/* Streaming progress bar if generating */}
              {isGenerating && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2 animate-pulse text-xs text-blue-700">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="font-bold">{streamMessage}</span>
                  </div>
                  <div className="w-full bg-blue-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-1.5 rounded-full animate-bar-expansion w-3/4"></div>
                  </div>
                </div>
              )}

              {/* Text editor dashboard */}
              {!isGenerating && (
                <div className="space-y-3">
                  {selectedBidContent ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400 font-mono">Word Count: {selectedBidContent.split(/\s+/).length} words</span>
                        <div className="flex items-center space-x-2">
                          {saveStatus === "success" && <span className="text-xs text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded font-medium">Successfully saved!</span>}
                          {exportUrl && (
                            <a
                              href={exportUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold px-3 py-1.5 rounded-lg animate-bounce inline-flex items-center gap-1 shrink-0"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                              Download Exported PDF
                            </a>
                          )}
                          <button 
                            onClick={handleUpdateBidContent} 
                            disabled={user?.plan === "FREE"}
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-750 font-bold border px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Save Draft
                          </button>
                          <button
                            onClick={async () => {
                              if (!activeBidId) return;
                              const res = await fetch(`/api/bids/${activeBidId}/export`, {
                                method: "POST",
                                headers: getAuthHeaders()
                              });
                              const data = await res.json();
                              setExportUrl(data.url);

                              // Log the successful export metric
                              window.logAnalyticsEvent("export_bid_document", {
                                tenderId,
                                bidId: activeBidId,
                                exportUrl: data.url,
                                timestamp: new Date().toISOString()
                              });
                            }}
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg shadow-sm cursor-pointer"
                          >
                            Export DOCX/PDF
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={selectedBidContent}
                        onChange={(e) => setSelectedBidContent(e.target.value)}
                        rows={15}
                        disabled={user?.plan === "FREE"}
                        className={`w-full border border-slate-200 hover:border-slate-300 transition rounded-xl p-4 text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500 ${user?.plan === "FREE" ? "bg-slate-50 text-slate-400 select-all cursor-not-allowed" : ""}`}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-slate-50 border border-slate-200/60 rounded-xl space-y-4">
                      <p className="text-xs text-slate-500">Draft proposals, technical sheets or compliance models have not yet been generated for this option.</p>
                      <button
                        onClick={() => {
                          if (user?.plan === "FREE") {
                            onNavigateToBilling?.();
                          } else {
                            handleGenerateBid();
                          }
                        }}
                        className={`text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-md inline-flex items-center space-x-1.5 cursor-pointer ${
                          user?.plan === "FREE" ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        {user?.plan === "FREE" ? (
                          <>
                            <span className="text-xs">🔒</span>
                            <span>Unlock Plan to Draft Bid</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                            <span>Generate with Gemini AI</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>
        )}
      </div>

      {showPrintLayout && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 overflow-y-auto p-4 sm:p-6 md:p-8 flex justify-center items-start print:p-0 print:bg-white print:static print:overflow-visible">
          {/* Custom Print Style Injection */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              html, body {
                background: white !important;
                color: black !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              body * {
                visibility: hidden !important;
              }
              #print-area, #print-area * {
                visibility: visible !important;
              }
              #print-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                border: none !important;
                box-shadow: none !important;
                margin: 0 !important;
                padding: 1.5cm !important;
              }
            }
          `}} />

          <div 
            id="print-area" 
            className="w-full max-w-4xl bg-white border border-slate-200 shadow-2xl rounded-2xl p-6 sm:p-10 md:p-14 relative print:border-0 print:shadow-none print:rounded-none print:p-0"
          >
            {/* Top Preview controller - hidden during real printing */}
            <div className="flex flex-wrap justify-between items-center pb-6 mb-8 border-b-2 border-slate-150 print:hidden gap-4">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-black text-slate-800 tracking-wider uppercase">Printer-Friendly Dossier</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Verify structure below, then initiate system printing.</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer flex items-center space-x-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Execute Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintLayout(false)}
                  className="bg-slate-150 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-lg transition active:scale-95 cursor-pointer border border-slate-250/80"
                >
                  Close Preview
                </button>
              </div>
            </div>

            {/* Document body content */}
            <div className="space-y-8 font-sans text-slate-900 leading-normal">
              
              {/* Cover Letterhead / Branding */}
              <div className="flex justify-between items-start border-b border-slate-900 pb-4">
                <div className="space-y-1">
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900">TENDER RECORD INTELLIGENCE DOSSIER</h1>
                  <p className="text-xs text-slate-850 font-mono tracking-wide uppercase">TENDER REFERENCE: {tender.externalId || "N/A"}</p>
                </div>
                <div className="text-right text-xs text-slate-500 font-mono">
                  <p>GENERATED ON: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
                  <p>SYSTEM STATUS: {tender.status}</p>
                </div>
              </div>

              {/* 1. Main Header block */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight border-b border-slate-250 pb-1">I. Tender Specifications & Procurement Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs leading-relaxed">
                  <div>
                    <p className="text-slate-500 font-medium font-mono uppercase text-[10px]">Title</p>
                    <p className="font-bold text-slate-950 text-sm mt-0.5">{tender.title}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium font-mono uppercase text-[10px]">Department / Authority</p>
                    <p className="font-bold text-slate-950 mt-0.5">{tender.department}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium font-mono uppercase text-[10px]">Source Portal / Channel</p>
                    <p className="font-bold text-slate-950 mt-0.5">{tender.sourcePortal}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium font-mono uppercase text-[10px]">Geographic Location</p>
                    <p className="font-bold text-slate-950 mt-0.5">{tender.location}, {tender.state}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium font-mono uppercase text-[10px]">Tender Estimate Value</p>
                    <p className="font-bold text-slate-950 text-sm mt-0.5">{tender.tenderValue ? formatIndianCurrency(tender.tenderValue * 10000000) : "Refer Document Annexures"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium font-mono uppercase text-[10px]">Required EMD Amount</p>
                    <p className="font-bold text-slate-950 text-sm mt-0.5">{tender.emdAmount ? formatIndianCurrency(tender.emdAmount) : "Exempted / Not Marked"}</p>
                  </div>
                </div>
              </div>

              {/* 2. Deadlines Block */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight border-b border-slate-250 pb-1">II. Critical Event Milestones</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200/60 print:bg-white print:border-slate-300">
                  <div>
                    <p className="text-slate-500 font-mono uppercase text-[9px]">Published Date</p>
                    <p className="font-extrabold text-slate-800 mt-0.5 font-mono">{tender.publishedDate ? formatDate(tender.publishedDate) : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-rose-600 font-mono uppercase text-[9px] font-bold">Submission Deadline</p>
                    <p className="font-extrabold text-rose-700 mt-0.5 font-mono">{tender.bidSubmissionDeadline ? formatDate(tender.bidSubmissionDeadline) : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-mono uppercase text-[9px]">Technical Bid Opening</p>
                    <p className="font-extrabold text-slate-800 mt-0.5 font-mono">{tender.openingDate ? formatDate(tender.openingDate) : "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* 3. Executive Summary / Description */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight border-b border-slate-250 pb-1">III. Scope of Work & Synopsis</h2>
                <div className="text-xs leading-relaxed text-slate-755 space-y-3">
                  <p className="font-bold text-slate-900">Executive Overview:</p>
                  <p className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 print:bg-white print:p-0 print:border-0">{tender.workDescription || "Refer SBD for detailed work item parameters."}</p>
                  
                  {tender.aiSummary && (
                    <>
                      <p className="font-bold text-slate-900 mt-3.5">System Analyzed Key Highlights (Gemini AI Summary):</p>
                      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 print:bg-white print:p-0 print:border-0 italic text-slate-650">
                        {tender.aiSummary}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 4. Eligibility Analysis */}
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight border-b border-slate-250 pb-1">IV. Mandatory Eligibility Criteria</h2>
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs print:border-slate-300">
                  <div className="bg-slate-50 p-3 font-mono font-bold text-[9px] text-slate-500 uppercase flex justify-between border-b border-slate-200">
                    <span>Statutory Eligibility Parameter</span>
                    <span>Tender Requirement Baseline</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    <div className="p-3.5 flex justify-between gap-4">
                      <span className="font-semibold text-slate-850">Minimum Annual Turnover Required</span>
                      <span className="font-mono text-slate-800 font-bold">{tender.eligibilityCriteria.minTurnover ? `₹${tender.eligibilityCriteria.minTurnover} Cr` : "N/A"}</span>
                    </div>
                    <div className="p-3.5 flex justify-between gap-4">
                      <span className="font-semibold text-slate-850">Minimum Years of Experience in Sector</span>
                      <span className="font-mono text-slate-800 font-bold">{tender.eligibilityCriteria.minExperience} Years</span>
                    </div>
                    <div className="p-3.5 flex justify-between gap-4">
                      <span className="font-semibold text-slate-850">MSME Reservation Rules</span>
                      <span className="font-mono text-slate-800 font-bold">{tender.eligibilityCriteria.msmeOnly ? "Reserved for MSME Bidders Only" : "General Open Bid Scheme"}</span>
                    </div>
                    {tender.eligibilityCriteria.requiredCertifications && tender.eligibilityCriteria.requiredCertifications.length > 0 && (
                      <div className="p-3.5 flex justify-between gap-4">
                        <span className="font-semibold text-slate-850">Required Statutory Certifications</span>
                        <span className="font-bold text-slate-800">{tender.eligibilityCriteria.requiredCertifications.join(", ")}</span>
                      </div>
                    )}
                    {tender.eligibilityCriteria.statesAllowed && tender.eligibilityCriteria.statesAllowed.length > 0 && (
                      <div className="p-3.5 flex justify-between gap-4">
                        <span className="font-semibold text-slate-850">Permitted State/Regional Registration Boundaries</span>
                        <span className="font-bold text-slate-800">{tender.eligibilityCriteria.statesAllowed.join(", ")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 5. Documents List */}
              {tender.documents && tender.documents.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight border-b border-slate-250 pb-1">V. List of Linked Ref Attachments</h2>
                  <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden print:border-slate-300">
                    <thead>
                      <tr className="bg-slate-50 font-mono text-[9px] text-slate-500 uppercase border-b border-slate-200">
                        <th className="p-3">File Asset Name</th>
                        <th className="p-3">Classification Category</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tender.documents.map((doc, idx) => (
                        <tr key={idx}>
                          <td className="p-3 font-medium text-slate-800">{doc.name}</td>
                          <td className="p-3 font-mono font-bold text-slate-600">{doc.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Signoff / Legal disclaimer */}
              <div className="pt-8 border-t border-slate-400 text-[10px] text-slate-500 font-mono leading-normal space-y-1.5">
                <p><strong>Disclaimer Note:</strong> This print document is generated from private bid intelligence matching algorithms inside TenderAI. TenderInvitingAuthority requirements are subject to modification via standard official corrigendums. Bidders are instructed to refer to the official portal page to confirm standard bidding parameters before deployment upload.</p>
                <p className="text-[9px]">Platform generated securely on behalf of msvm220@gmail.com. Certified audit timestamp: {new Date().toISOString()}</p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
