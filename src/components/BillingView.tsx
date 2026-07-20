import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { 
  Sparkles, 
  CreditCard, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Printer, 
  QrCode, 
  Banknote, 
  ShieldCheck, 
  Info,
  Sliders,
  DollarSign,
  Download
} from "lucide-react";
import { User, CompanyProfile } from "../types.js";
import { jsPDF } from "jspdf";
import { formatIndianCurrency } from "../utils/formatters.js";
import { formatDate, getAuthHeaders } from "../utils.js";
import { useFirebase } from "../FirebaseContext.js";
import { db, handleFirestoreError, OperationType } from "../firebase.js";
import { doc, setDoc } from "firebase/firestore";

interface BillingViewProps {
  user: User | null;
  profile: CompanyProfile | null;
  onUpdateUser: (updatedUser: any) => void;
  onToast: (title: string, message: string, type: string) => void;
  initialSelectedPlanId?: string | null;
  onClearInitialPlan?: () => void;
}

export default function BillingView({ 
  user, 
  profile, 
  onUpdateUser, 
  onToast,
  initialSelectedPlanId,
  onClearInitialPlan
}: BillingViewProps) {
  const { firebaseUser, saveUserToFirestore } = useFirebase();
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<any | null>(null);
  const [paymentMode, setPaymentMode] = useState<"CASHFREE" | "RAZORPAY">("CASHFREE");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);

  // Invoice parameters state
  const [invoiceBusinessName, setInvoiceBusinessName] = useState(profile?.companyName || "Sharma Construction & Infra, Pvt Ltd");
  const [invoicePAN, setInvoicePAN] = useState(profile?.panNumber || "AAACX1234F");
  const [invoiceFinancialYear, setInvoiceFinancialYear] = useState("FY 2025-26");
  const [invoiceNumberSeries, setInvoiceNumberSeries] = useState("INV-2025-001");
  const [invoiceStateCode, setInvoiceStateCode] = useState(profile?.states?.[0] || "Bihar");
  
  // Local state mirror for trial simulation configuration (this keeps immediate reactivity)
  const [trialActive, setTrialActive] = useState<boolean>(true);
  const [trialDays, setTrialDays] = useState<number>(1);

  // Payment portal & simulated intent capturing state
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [checkoutStep, setCheckoutStep] = useState<"SELECT_GATEWAY" | "GATEWAY_FORM" | "OTP_SCREEN" | "PAYMENT_DONE">("SELECT_GATEWAY");
  const [checkoutMethod, setCheckoutMethod] = useState<"CARD" | "UPI" | "NET_BANKING">("CARD");
  
  // Simulated gateway input fields
  const [cardNumber, setCardNumber] = useState("4111 2222 3333 4444");
  const [cardExpiry, setCardExpiry] = useState("12/29");
  const [cardCvv, setCardCvv] = useState("123");
  const [upiVal, setUpiVal] = useState("ramesh@oksbi");
  const [otpCode, setOtpCode] = useState("");
  const [selectedBank, setSelectedBank] = useState("State Bank of India");

  // Advanced Gateway & Checkout Customer Infused Inputs
  const [cardName, setCardName] = useState("Ramesh Sharma");
  const [billingPin, setBillingPin] = useState("800001");
  const [customerPhone, setCustomerPhone] = useState("919999999999");
  const [customerEmail, setCustomerEmail] = useState(user?.email || "sharma.infra@gmail.com");
  const [selectedUpiApp, setSelectedUpiApp] = useState("PhonePe");

  const fetchPaymentHistory = async () => {
    try {
      const res = await fetch("/api/payments/history", {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentHistory(data);
      }
    } catch (err) {
      console.error("Failed to load payment history:", err);
    }
  };

  // Fetch or sync the initial user state
  useEffect(() => {
    if (user) {
      setTrialActive((user as any).isTrialActive !== false);
      setTrialDays((user as any).trialDaysElapsed || 1);
      fetchPaymentHistory();
    }
  }, [user]);



  // Handle plan details definition
  const plans = [
    {
      id: "FREE",
      name: "Bharat (Free)",
      originalMonthly: 0,
      discountMonthly: 0,
      annualCost: 0,
      savingsText: "₹0",
      features: [
        "Tender Discovery: 5 matched tenders only",
        "AI Summarization: 3 summaries/month (hard wall)",
        "Match Scoring: Score number visible (e.g., 87%), eligibility breakdown blurred",
        "Alerts: Email only, daily digest",
        "Profile: 1 company profile",
        "Vault: 3 documents max",
        "Q&A: Not included",
        "Bid Generation: Not included",
        "Pay-per-use: ₹499 for one AI bid document"
      ],
      description: "Created for micro-contractors starting with local municipal bids, limited to 5 matched tenders only"
    },
    {
      id: "STARTER",
      name: "Starter Trial",
      originalMonthly: 3000,
      discountMonthly: 2000,
      annualCost: 20000, // save ₹16,000
      savingsText: "save ₹16,000",
      features: [
        "Tender Discovery: 5 matched tenders only",
        "Features Unlocked: Full AI features for up to 10 tenders",
        "AI Summarization: Uncapped RAG synopsis check",
        "Match Scoring: Full criteria compliance check list",
        "Alerts: Email + WhatsApp alerts",
        "Profile: 1 company profile criteria",
        "Vault: Up to 20 business filings",
        "Q&A: Unlimited interactive clarifications",
        "Bid Generation: Custom drafted files per month",
        "Team: 1 user access",
        "Support: Priority email support channel"
      ],
      description: "10-day Starter trial with full features for 10 tenders, limited to 5 matched tenders only"
    },
    {
      id: "PROFESSIONAL",
      name: "Professional",
      originalMonthly: 10000,
      discountMonthly: 5000,
      annualCost: 50000, // save ₹70,000
      savingsText: "save ₹70,000",
      features: [
        "Tender Discovery: Unlimited matched tenders",
        "AI Summarization: Unlimited summaries",
        "Match Scoring: Full breakdown + Go/No-Go verdict + missing items action plan",
        "Alerts: Email + WhatsApp + SMS + real-time push",
        "Profile: 3 company profiles",
        "Vault: Unlimited documents + expiry alerts",
        "Q&A: Unlimited RAG-based Q&A with citations",
        "Bid Generation: 20 AI-generated documents/month + DOCX/PDF export",
        "Analytics: Full intelligence suite (win probability, competitor tracking, department insights)",
        "Team: Up to 3 users",
        "Extras: Pre-submission audit engine, corrigendum tracker",
        "Support: Priority chat support (24-hour response)"
      ],
      description: "Comprehensive civil-bid generation center for active tender portfolios",
      badge: "Best Value"
    },
    {
      id: "ENTERPRISE",
      name: "Enterprise",
      originalMonthly: 25000,
      discountMonthly: 10000,
      annualCost: 100000, // save ₹200,000
      savingsText: "save ₹200,000",
      features: [
        "Everything in Professional, plus:",
        "Profile: 10 company profiles",
        "Team: Up to 10 users with role-based access",
        "REST API access",
        "Embeddable tender widget for association websites",
        "Dedicated account manager",
        "Monthly team training webinars",
        "Support: Phone support"
      ],
      description: "Maximum bandwidth and premium custom integrations for large infrastructure agencies"
    }
  ];

  // Function to commit updated plan/trial parameters to the server database
  const commitPlanUpdate = async (updatedFields: any) => {
    try {
      const res = await fetch("/api/user/plan", {
        method: "PUT",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(updatedFields),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdateUser(data);
      }
    } catch (err) {
      console.error("Failed to sync structural plan update on server:", err);
    }
  };

  // Upgrades plan immediately
  const handleUpgradeSelect = (plan: any) => {
    setSelectedPlanForCheckout(plan);
    setCheckoutStep("SELECT_GATEWAY");
    setCheckoutMethod("CARD");
    setOtpCode("");
    setIsProcessingPayment(false);
  };

  // Support hot loading a plan selection from the UpgradeView comparative table
  useEffect(() => {
    if (initialSelectedPlanId) {
      const selectedPlan = plans.find((p) => p.id === initialSelectedPlanId);
      if (selectedPlan) {
        handleUpgradeSelect(selectedPlan);
      }
      if (onClearInitialPlan) {
        onClearInitialPlan();
      }
    }
  }, [initialSelectedPlanId]);

  // Load SDK Script dynamically for real checkout integrations
  const loadRazorpayScript = () => {
    return new Promise<boolean>((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Action for securing simulated/real checkout intent captures
  const handleCompletePaymentIntentCapture = async () => {
    if (!selectedPlanForCheckout) return;

    setIsProcessingPayment(true);
    
    const unitPrice = billingCycle === "MONTHLY" 
      ? selectedPlanForCheckout.discountMonthly 
      : selectedPlanForCheckout.annualCost;

    // 1. RAZORPAY INTEGRATION LOGIC
    if (paymentMode === "RAZORPAY") {
      try {
        const orderRes = await fetch("/api/payments/razorpay/create-order", {
          method: "POST",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            planId: selectedPlanForCheckout.id,
            amount: unitPrice,
            billingCycle,
          })
        });

        if (orderRes.ok) {
          const orderData = await orderRes.json();
          const { isLive, razorpayKeyId, orderId } = orderData;

          if (isLive && razorpayKeyId !== "rzp_test_mock_keys") {
            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) {
              onToast(
                "SDK ERROR", 
                "Failed to download Razorpay checkout gateway scripts. Defaulting to sandbox validation.", 
                "DEADLINE_REMINDER"
              );
            } else {
              const rzpOptions = {
                key: razorpayKeyId,
                amount: Math.round(unitPrice * 100),
                currency: "INR",
                name: "Bharat TenderAI",
                description: `${selectedPlanForCheckout.name} Subscription Plan`,
                order_id: orderId,
                handler: async (response: any) => {
                  try {
                    setIsProcessingPayment(true);
                    const verifyRes = await fetch("/api/payments/razorpay/verify", {
                      method: "POST",
                      headers: getAuthHeaders({ "Content-Type": "application/json" }),
                      body: JSON.stringify({
                        planId: selectedPlanForCheckout.id,
                        amount: unitPrice,
                        billingCycle,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_signature: response.razorpay_signature,
                        isLive: true
                      })
                    });

                    if (verifyRes.ok) {
                      const data = await verifyRes.json();
                      onUpdateUser(data.user);
                      
                      if (firebaseUser) {
                        await saveUserToFirestore({ ...user, plan: selectedPlanForCheckout.id });
                      }

                      onToast(
                        "RAZORPAY SUCCESS",
                        `Successfully finalized ₹${unitPrice.toLocaleString()} live payment! ID: ${response.razorpay_payment_id}`,
                        "STATUS_CHANGE"
                      );
                      
                      await fetchPaymentHistory();
                      setCheckoutStep("PAYMENT_DONE");
                      
                      // Confetti
                      confetti({
                        particleCount: 150,
                        spread: 80,
                        origin: { y: 0.6 }
                      });
                    } else {
                      onToast("SECURITY MISMATCH", "Razorpay verification signatures match failed.", "DEADLINE_REMINDER");
                    }
                  } catch (verifyErr) {
                    console.error("[Payment Gateway] Verification crash:", verifyErr);
                  } finally {
                    setIsProcessingPayment(false);
                  }
                },
                prefill: {
                  name: cardName || "Ramesh Sharma",
                  email: customerEmail || "sharma.infra@gmail.com",
                  contact: customerPhone || "919999999999",
                },
                theme: {
                  color: "#2563EB",
                }
              };
              const rzp = new (window as any).Razorpay(rzpOptions);
              rzp.open();
              setIsProcessingPayment(false);
              return; // Quit early to allow Razorpay UI wrapper control
            }
          }
        }
      } catch (err) {
        console.warn("[Payment Gateway] Live Razorpay order initiation skipped:", err);
      }
    }



    // 3. SECURE FALLBACK/SIMULATION INTEGRATION Flow (if live credentials are empty or Cashfree is selected)
    try {
      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          planId: selectedPlanForCheckout.id,
          amount: unitPrice,
          billingCycle,
          gateway: paymentMode, // CASHFREE or RAZORPAY
          method: checkoutMethod // CARD, UPI, or NET_BANKING
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Update user context state immediately
        onUpdateUser(data.user);
        
        // Write to Firestore if the user is authenticated via Firebase
        if (firebaseUser) {
          try {
            await saveUserToFirestore({
              ...user,
              plan: selectedPlanForCheckout.id
            });

            // Capture complete PaymentIntent item with user details in Firestore collection
            const intentDocId = data.paymentIntent.id;
            await setDoc(doc(db, "paymentIntents", intentDocId), {
              id: intentDocId,
              userId: firebaseUser.uid,
              planId: selectedPlanForCheckout.id,
              amount: Number(unitPrice),
              billingCycle,
              gateway: paymentMode,
              method: checkoutMethod,
              status: "CAPTURED",
              createdAt: data.paymentIntent.createdAt || new Date().toISOString()
            });
          } catch (fireErr) {
            console.error("Firestore sync fail during checkout:", fireErr);
            handleFirestoreError(fireErr, OperationType.WRITE, `paymentIntents/${data.paymentIntent?.id}`);
          }
        }
        
        onToast(
          `${paymentMode} CAPTURE SUCCESS`,
          `Successfully processed ₹${unitPrice.toLocaleString()} via ${paymentMode}. Payment intent has been secured with ID ${data.paymentIntent.id}!`,
          "STATUS_CHANGE"
        );
        
        // Log premium commercial upgrade event
        window.logAnalyticsEvent("purchase_tier_success", {
          planId: selectedPlanForCheckout.id,
          amount: Number(unitPrice),
          billingCycle,
          gateway: paymentMode,
          method: checkoutMethod,
          intentId: data.paymentIntent.id,
          timestamp: new Date().toISOString()
        });
        
        // Refresh payment history log
        await fetchPaymentHistory();
        
        setCheckoutStep("PAYMENT_DONE");

        // Fire festive, multi-burst high-performance confetti celebration!
        const duration = 2.5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 3000 };

        const randomInRange = (min: number, max: number) => {
          return Math.random() * (max - min) + min;
        };

        const interval = setInterval(() => {
          const timeLeft = animationEnd - Date.now();

          if (timeLeft <= 0) {
            return clearInterval(interval);
          }

          const particleCount = 50 * (timeLeft / duration);
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
          confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 200);
      } else {
        const errData = await res.json();
        onToast(
          "PAYMENT DECLINED",
          errData.error || "Simulation error occurred during card authorization.",
          "DEADLINE_REMINDER"
        );
      }
    } catch (err) {
      console.error("Payment intent request failed:", err);
      onToast("CONNECTION ERROR", "Failed to communicate with payment gateway simulator.", "DEADLINE_REMINDER");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Slider change callback for fast-forwarding trials
  const handleTrialSliderChange = async (days: number) => {
    setTrialDays(days);
    
    // Auto-downgrade to FREE if they fast-forward past Day 10
    let targetPlan = user?.plan || "FREE";
    if (days >= 10) {
      targetPlan = "FREE";
    } else {
      targetPlan = "STARTER"; // Maintain simulated trial plan
    }

    const fields = {
      plan: targetPlan,
      isTrialActive: days < 10,
      trialDaysElapsed: days
    };

    // Trigger simulation notifications based on selected day checkpoints
    if (days === 2) {
      onToast(
        "TRIAL CHECKPOINT: DAY 2",
        "Simulated Day 2 Blocker is active! Complete your compliance criteria checklist (annual turnovers, geo zones) to resume matching.",
        "DEADLINE_REMINDER"
      );
    } else if (days === 7) {
      onToast(
        "TRIAL CHECKPOINT: DAY 7",
        "Simulated Warning Issued: Your 10-day Starter trial is ending in 3 days. Double-check your Compliance Station or alerts backlog.",
        "DEADLINE_REMINDER"
      );
      // Let's call the backend alert trigger so it seeds the alert in the database!
      try {
        await fetch("/api/alerts/simulate", {
          method: "POST",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            type: "DEADLINE_REMINDER",
            title: "Simulated Day 7 Warning: 3 Days Left in Trial",
            description: "Your 10-day Starter Plan trial is scheduled to expire soon on Day 10. Your active AI documents workspace will transition to view-only mode. Upgrade to Starter or Professional now to preserve full editable bids.",
            associatedTenderId: ""
          })
        });
      } catch (err) {
        console.warn("Failed to seed Day 7 alert:", err);
      }
    } else if (days >= 10) {
      onToast(
        "TRIAL CHECKPOINT: DAY 10",
        "Trial Period Expired! Your active workspace has auto-downgraded to the FREE (Bharat) plan with View-Only lock on AI workspace.",
        "STATUS_CHANGE"
      );
    }

    await commitPlanUpdate(fields);
  };

  // Generates compliant GST-free official invoice PDF matching Section 4 requirements
  const handlePrintDownloadInvoice = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const primaryColor = { r: 15, g: 23, b: 42 }; // Dark Slate
    const grayColor = { r: 75, g: 85, b: 99 }; // Cool Grey

    // Title / Header
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.text("TENDERAI SOLUTIONS", 20, 25);

    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(grayColor.r, grayColor.g, grayColor.b);
    doc.text(`Invoice #TA-${invoiceNumberSeries.replace(/[^0-9]/g, '') || "0001"} | Date: ${formatDate(new Date().toISOString())}`, 20, 31);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(20, 35, 190, 35);

    // Bill To
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.text("Bill To:", 20, 43);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(grayColor.r, grayColor.g, grayColor.b);
    doc.text(invoiceBusinessName, 20, 48);
    doc.text(`PAN: ${invoicePAN}`, 20, 53);
    doc.text(`Region: ${invoiceStateCode}`, 20, 58);

    doc.line(20, 64, 190, 64);

    // Table Header
    let currentY = 72;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.text("Description", 20, currentY);
    doc.text("Amount", 160, currentY);

    doc.line(20, currentY + 3, 190, currentY + 3);
    currentY += 10;

    // Table Row
    const activePlanObj = plans.find((p) => p.id === (user?.plan || "STARTER")) || plans[1];
    const unitPrice = billingCycle === "MONTHLY" ? activePlanObj.discountMonthly : activePlanObj.annualCost;

    doc.setFont("Helvetica", "normal");
    doc.text(`${activePlanObj.name} Plan (${billingCycle === "MONTHLY" ? "Monthly" : "Annual"})`, 20, currentY);
    doc.text(`INR ${unitPrice.toLocaleString()}`, 160, currentY);

    currentY += 8;
    doc.line(20, currentY, 190, currentY);

    // Totals Block
    currentY += 8;
    doc.setFont("Helvetica", "bold");
    doc.text("Total Amount", 20, currentY);
    doc.text(`INR ${unitPrice.toLocaleString()}`, 160, currentY);

    // Amount in Words
    const getAmountInWordsStr = (val: number): string => {
      switch (val) {
        case 0: return "Zero Only";
        case 2000: return "Two Thousand Only";
        case 5000: return "Five Thousand Only";
        case 10000: return "Ten Thousand Only";
        case 20000: return "Twenty Thousand Only";
        case 50000: return "Fifty Thousand Only";
        case 100000: return "One Lakh Only";
        default: return `${val.toLocaleString()} Only`;
      }
    };

    currentY += 7;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(grayColor.r, grayColor.g, grayColor.b);
    doc.text(`Amount in Words: ${getAmountInWordsStr(unitPrice)}`, 20, currentY);

    // Payment Mode
    currentY += 10;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.text(`Payment Mode: UPI / Bank Transfer`, 20, currentY);

    doc.line(20, currentY + 4, 190, currentY + 4);

    // Official Regulatory GST Exemption Notes (Matching Section 4 literal instructions)
    currentY += 12;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);
    doc.text("GST EXEMPTION DECLARATION", 20, currentY);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Note: Service provider is not registered under GST as annual turnover is below the prescribed threshold.", 20, currentY + 5);
    doc.text(`PAN: ${invoicePAN || "AACCS1432K"}`, 20, currentY + 9);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(185, 28, 28); // amber-red alert
    doc.text("This is not a GST invoice. No GST has been charged.", 20, currentY + 14);

    // Print to file
    doc.save(`Invoice_TA_${invoiceNumberSeries.replace(/[^a-z0-9_-]/gi, '_')}.pdf`);
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Visual Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-905">Consolidated Subscription & Billing</h2>
        <p className="text-sm text-slate-500 mt-1">
          Review premium subscription tiers, manage tax-exempt (no-GST) commercial invoices, and customize active trial simulation days.
        </p>
      </div>

      {/* Trial Simulation Console Card */}
      <div className="bg-gradient-to-br from-indigo-900 to-[#121B32] text-white rounded-2xl p-6 shadow-xl border border-indigo-950/20 relative overflow-hidden">
        {/* Decorative background grid and accent blur */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500 rounded-full filter blur-3xl opacity-15 pointer-events-none translate-x-32 -translate-y-32" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400 animate-pulse" />
              <span className="text-xs font-black uppercase text-indigo-300 tracking-wider">Live Sandbox Simulator</span>
            </div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>10-day Starter Plan Trial Simulator</span>
              {trialActive && (
                <span className="text-[10px] font-black bg-blue-500 text-white px-2 py-0.5 rounded-full uppercase shrink-0">
                  Active
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Slide or fast-forward simulated elapsed trial days to test conditional paywall gates instantly:
              Day 2 imposes an onboarding criteria block; Day 7 warns of upcoming expiration; Day 10 triggers automatic downgrade view-only lock on the AI draft workspace editing.
            </p>
          </div>
          
          {/* Status Indicators representing simulation gates */}
          <div className="flex flex-wrap gap-2 md:self-end">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full border ${
              trialDays >= 2 
                ? "bg-amber-950/40 text-amber-400 border-amber-800/40" 
                : "bg-slate-800/50 text-slate-400 border-slate-700/30"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${trialDays >= 2 ? "bg-amber-400 animate-pulse" : "bg-slate-500"}`} />
              <span>Day 2 Block: {trialDays >= 2 ? "ACTIVE" : "PENDING"}</span>
            </span>
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full border ${
              trialDays >= 7 
                ? "bg-amber-950/40 text-amber-400 border-amber-800/40" 
                : "bg-slate-800/50 text-slate-400 border-slate-700/30"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${trialDays >= 7 ? "bg-amber-400 animate-pulse" : "bg-slate-500"}`} />
              <span>Day 7 Warn: {trialDays >= 7 ? "SENT" : "PENDING"}</span>
            </span>
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full border ${
              trialDays >= 10 
                ? "bg-red-950/40 text-rose-450 border-red-900/30" 
                : "bg-slate-800/50 text-slate-400 border-slate-700/30"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${trialDays >= 10 ? "bg-red-500 animate-pulse" : "bg-slate-500"}`} />
              <span>Downgrade Wall: {trialDays >= 10 ? "LOCKED" : "UNLOCKED"}</span>
            </span>
          </div>
        </div>

        {/* Live Simulation Controls */}
        <div className="mt-6 border-t border-indigo-850/60 pt-5 relative z-10 grid md:grid-cols-5 gap-6 items-center">
          <div className="md:col-span-3 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-350">Drag simulated elapsed time:</span>
              <span className="text-sm font-mono font-black text-indigo-300">
                Day {trialDays} / 10 Elapsed
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="11"
              step="1"
              value={trialDays}
              onChange={(e) => handleTrialSliderChange(Number(e.target.value))}
              className="w-full h-2.5 bg-indigo-950 rounded-lg appearance-none cursor-pointer accent-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Day 1: Enrolled</span>
              <span>Day 2: Checklist Gate</span>
              <span>Day 7: Warn Alert</span>
              <span>Day 10+: Downgrade View Only</span>
            </div>
          </div>

          <div className="md:col-span-2 flex justify-start md:justify-end gap-2 shrink-0">
            <button
              onClick={() => handleTrialSliderChange(2)}
              className="px-3 py-1.5 bg-indigo-800/80 hover:bg-indigo-700/90 rounded-lg text-xs font-bold border border-indigo-750 cursor-pointer active:scale-95 transition-all"
            >
              Simulate Day 2 Block
            </button>
            <button
              onClick={() => handleTrialSliderChange(7)}
              className="px-3 py-1.5 bg-indigo-800/80 hover:bg-indigo-700/90 rounded-lg text-xs font-bold border border-indigo-750 cursor-pointer active:scale-95 transition-all"
            >
              Simulate Day 7 Alert
            </button>
            <button
              onClick={() => handleTrialSliderChange(10)}
              className="px-3 py-1.5 bg-red-800/80 hover:bg-red-700/95 rounded-lg text-xs font-bold border border-red-900/30 cursor-pointer active:scale-95 transition-all"
            >
              Simulate Expired Day 10
            </button>
          </div>
        </div>
      </div>

      {/* Plans Section Selection Header */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">Choose Your Service Plan</h3>
            <p className="text-xs text-slate-500">Unregistered business operations enjoy full tax-exempt status under PAN allocation laws.</p>
          </div>

          {/* Billing cycle Monthly/Annual toggle */}
          <div className="bg-slate-100 hover:bg-slate-150 p-1 rounded-xl border border-slate-200 inline-flex items-center">
            <button
              onClick={() => setBillingCycle("MONTHLY")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                billingCycle === "MONTHLY" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle("ANNUAL")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                billingCycle === "ANNUAL" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>Annual Cycle</span>
              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-emerald-200">
                Save 17%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Tiers Cards Grid with Anchoring Rates */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isCurrent = user?.plan === plan.id;
            
            // Pricing math
            const showStrikethrough = plan.originalMonthly > 0;
            const displayedPrice = billingCycle === "MONTHLY" 
              ? plan.discountMonthly 
              : plan.annualCost;

            return (
              <div
                key={plan.id}
                className={`flex flex-col justify-between bg-white/60 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all relative ${
                  isCurrent 
                    ? "border-blue-600 ring-2 ring-blue-500/20" 
                    : plan.badge 
                    ? "border-blue-200 ring-1 ring-blue-105" 
                    : "border-slate-200/80"
                }`}
              >
                {/* Plan Highlights */}
                {plan.badge && (
                  <span className="absolute -top-3 left-6 bg-blue-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-sm shadow-blue-300">
                    {plan.badge}
                  </span>
                )}

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <h4 className="font-black text-gray-900 text-lg">{plan.name}</h4>
                    <p className="text-[10.5px] text-slate-400 leading-relaxed font-normal min-h-[32px]">
                      {plan.description}
                    </p>
                  </div>

                  {/* Dynamic Pricing Displays */}
                  <div className="border-t border-b border-slate-100 py-3">
                    {plan.id === "FREE" ? (
                      <div className="flex items-baseline space-x-1">
                        <span className="text-2xl font-black text-slate-900">₹0</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">Forever</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          {/* Anchoring Pricing original cost display */}
                          {showStrikethrough && (
                            <span className="text-xs text-slate-400 line-through font-medium">
                              ₹{(billingCycle === "MONTHLY" ? plan.originalMonthly : (plan.originalMonthly * 12)).toLocaleString()}
                            </span>
                          )}
                          <span className="text-2xl font-black text-slate-900">
                            ₹{displayedPrice.toLocaleString()}
                          </span>
                          {billingCycle === "ANNUAL" && plan.id !== "FREE" && (
                            <span className="text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-250 px-2 py-0.5 rounded ml-1 animate-pulse">
                              {plan.savingsText}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                          {billingCycle === "MONTHLY" ? "Per Month Rate" : `Annual Price (${plan.savingsText})`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Feature Checkpoints */}
                  <div className="space-y-3 pt-1">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Plan Deliverables</span>
                    <ul className="space-y-2">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start text-[11px] text-slate-600 font-normal">
                          <CheckCircle className="w-3.5 h-3.5 text-blue-500 mr-2 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Call-to-action Action buttons */}
                <div className="pt-6">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full bg-slate-100 border border-slate-200 text-slate-400 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1 cursor-not-allowed"
                    >
                      <CheckCircle className="w-4 h-4 text-slate-400" />
                      <span>Current Active Plan</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpgradeSelect(plan)}
                      className={`w-full text-center py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-xs ${
                        plan.badge
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "bg-white hover:bg-slate-50 text-slate-800 border border-slate-350"
                      }`}
                    >
                      {plan.id === "FREE" ? "Downgrade to Bharat" : `Subscribe to ${plan.name}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice Constructor Panel */}
      <div className="grid md:grid-cols-5 gap-6">
        {/* Left Side: Tax-Exempt Invoicing Information Explanation */}
        <div className="md:col-span-2 bg-white/60 backdrop-blur-md border border-white/25 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Info className="w-4.5 h-4.5 text-blue-600" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Unregistered No-GST Invoicing</h4>
          </div>
          
          <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
            <p>
              Under **Section 22 and 24** of the Central Goods and Services Tax Act 2017 in India, contractors or procurement providers with aggregate annual turnovers below specified thresholds are **fully exempted** from compulsory GST registration.
            </p>
            <p>
              TenderAI generates standard tax-compliant unregistered invoices. You can configure invoices with your business PAN card credential, state jurisdiction, custom series numbers, and download print-ready PDFs.
            </p>
          </div>

          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 space-y-2 text-xs">
            <span className="font-extrabold text-blue-800 uppercase text-[9px] tracking-wider block">GST Waiver Threshold Checklist:</span>
            <ul className="space-y-1.5 font-medium text-slate-600 text-[11px]">
              <li className="flex items-center gap-1.5">
                <div className="w-1 h-1 bg-blue-500 rounded-full" />
                <span>Service suppliers threshold: ₹20 Lakhs</span>
              </li>
              <li className="flex items-center gap-1.5">
                <div className="w-1 h-1 bg-blue-500 rounded-full" />
                <span>North-Eastern/Hill states threshold: ₹10 Lakhs</span>
              </li>
              <li className="flex items-center gap-1.5">
                <div className="w-1 h-1 bg-blue-500 rounded-full" />
                <span>Goods suppliers threshold: ₹40 Lakhs</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => setShowInvoiceForm(!showInvoiceForm)}
            className="w-full text-center py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 font-bold"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            <span>{showInvoiceForm ? "Hide Invoice Parameters" : "Edit Invoicing Parameters"}</span>
          </button>
        </div>

        {/* Right Side: Invoice Form & Generator Display */}
        <div className="md:col-span-3 bg-white/60 backdrop-blur-md border border-white/25 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h4 className="text-sm font-bold text-slate-900 uppercase">Compliant Invoice Hub</h4>
            <button
              onClick={handlePrintDownloadInvoice}
              className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Printable PDF</span>
            </button>
          </div>

          {/* Collapsible edit form */}
          {showInvoiceForm && (
            <div className="p-4 bg-slate-55 border border-slate-150 rounded-xl space-y-3 text-xs grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Corporate Legal Name</label>
                <input
                  type="text"
                  value={invoiceBusinessName}
                  onChange={(e) => setInvoiceBusinessName(e.target.value)}
                  className="w-full bg-white border border-slate-250 hover:border-slate-350 focus:border-blue-500 rounded-lg px-2.5 py-1.5 font-bold text-slate-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Business PAN (Fixed Allocation)</label>
                <input
                  type="text"
                  value={invoicePAN}
                  onChange={(e) => setInvoicePAN(e.target.value)}
                  className="w-full bg-white border border-slate-250 hover:border-slate-350 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-slate-700 font-mono focus:outline-none"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">State / Union Territory</label>
                <input
                  type="text"
                  value={invoiceStateCode}
                  onChange={(e) => setInvoiceStateCode(e.target.value)}
                  className="w-full bg-white border border-slate-250 hover:border-slate-350 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Invoice Series Code</label>
                <input
                  type="text"
                  value={invoiceNumberSeries}
                  onChange={(e) => setInvoiceNumberSeries(e.target.value)}
                  className="w-full bg-white border border-slate-250 hover:border-slate-350 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-slate-700 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Fiscal Operating Year</label>
                <select
                  value={invoiceFinancialYear}
                  onChange={(e) => setInvoiceFinancialYear(e.target.value)}
                  className="w-full bg-white border border-slate-250 hover:border-slate-350 focus:border-blue-500 rounded-lg p-1.5 text-slate-700 focus:outline-none"
                >
                  <option value="FY 2025-26">FY 2025-26</option>
                  <option value="FY 2024-25">FY 2024-25</option>
                  <option value="FY 2026-27">FY 2026-27</option>
                </select>
              </div>
            </div>
          )}

          {/* Visual Invoice Mock representation */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 font-sans space-y-4">
            <div className="flex justify-between items-start text-xs">
              <div>
                <span className="bg-slate-200 text-slate-800 text-[9px] font-black tracking-wider px-2 py-0.5 rounded uppercase">
                  Exempt / Unregistered Invoice
                </span>
                <p className="font-bold text-slate-800 mt-2">SME Procurement Systems Pvt Ltd</p>
                <p className="text-[10px] text-slate-500">Patna Corridor, Bihar</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-405 font-bold uppercase tracking-wider block">Serial No.</span>
                <span className="font-mono font-bold text-slate-800">{invoiceNumberSeries}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-b border-indigo-200/40 py-3 text-[11px] text-slate-600">
              <div>
                <span className="font-extrabold text-[9px] uppercase tracking-wider text-slate-400 block mb-1">Customer Delivery Link:</span>
                <p className="font-bold text-slate-800">{invoiceBusinessName}</p>
                <p>PAN Code: <span className="font-mono font-semibold">{invoicePAN}</span></p>
                <p>Region: <span className="font-semibold">{invoiceStateCode}</span></p>
              </div>
              <div className="text-right">
                <p>Fiscal Session: <span className="font-bold">{invoiceFinancialYear}</span></p>
                <p>Tax Structure: <span className="font-bold text-emerald-600">GST-Exempt (0%)</span></p>
                <p className="font-medium">Waiver reference: Section 22/24 CGST Act</p>
              </div>
            </div>

            {/* Calculations mockup */}
            <div className="text-xs space-y-1.5 border-b border-slate-200/60 pb-3">
              <div className="flex justify-between font-bold text-slate-800">
                <span>Software Suite subscription ({(plans.find((p) => p.id === (user?.plan || "STARTER")) || plans[1]).name})</span>
                <span>INR {billingCycle === "MONTHLY" ? (plans.find((p) => p.id === (user?.plan || "STARTER")) || plans[1]).discountMonthly?.toLocaleString() : (plans.find((p) => p.id === (user?.plan || "STARTER")) || plans[1]).annualCost?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>GST Tax (Rate: 0%)</span>
                <span>₹0.00</span>
              </div>
              <div className="flex justify-between font-extrabold text-blue-700 border-t border-dashed border-slate-250 pt-2 text-sm">
                <span>Consolidated Net Total</span>
                <span>INR {billingCycle === "MONTHLY" ? (plans.find((p) => p.id === (user?.plan || "STARTER")) || plans[1]).discountMonthly?.toLocaleString() : (plans.find((p) => p.id === (user?.plan || "STARTER")) || plans[1]).annualCost?.toLocaleString()}</span>
              </div>
            </div>

            <p className="text-[9.5px] italic text-slate-450 leading-normal text-center">
              "Exemption Declaration: Supply of services supplied herein is fully exempt under Section 22 and 24 CGST Act, as aggregate supplier turnover falls below statutory mandates requiring registration."
            </p>
          </div>
        </div>
      </div>

      {/* Section 7 Educational Guidance segment */}
      <div className="bg-white/60 backdrop-blur-md border border-white/25 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-rose-100 pb-3 mb-4">
          <TrendingUp className="w-5 h-5 text-rose-500" />
          <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-wide">Regulatory Guide: When You Must Register for GST</h3>
        </div>
        
        <p className="text-xs text-slate-500 leading-relaxed mb-4">
          As a growing contractor software user in India, you can legally operate <b>without a GSTIN</b> as long as your annual aggregate turnover is below specified limits. Follow these critical trigger scenarios to transition safely:
        </p>

        <div className="grid md:grid-cols-3 gap-5 text-xs">
          <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-200/50 space-y-2">
            <span className="font-extrabold text-amber-800 uppercase text-[9px] tracking-wider block bg-amber-100/50 w-fit px-2 py-0.5 rounded">
              Scenario 1: Revenue hits ₹15 Lakh
            </span>
            <span className="font-black text-slate-900 block text-xs">Proactive Preparation Buffer</span>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Start consolidating your digital documentation, verify your corporate parameters, and compile draft certificates to coordinate quick registration. This prevents business friction.
            </p>
          </div>

          <div className="p-4 bg-red-50/40 rounded-xl border border-red-200/50 space-y-2">
            <span className="font-extrabold text-red-800 uppercase text-[9px] tracking-wider block bg-red-100/50 w-fit px-2 py-0.5 rounded">
              Scenario 2: Revenue hits ₹20 Lakh
            </span>
            <span className="font-black text-slate-900 block text-xs">Compulsory Statutory Mandate</span>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              <b>Mandatory Action</b>: Instantly file your GST registration. You must freeze manual invoicing immediately until your certified GSTIN is received and assigned.
            </p>
          </div>

          <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-200/50 space-y-2">
            <span className="font-extrabold text-blue-800 uppercase text-[9px] tracking-wider block bg-blue-100/50 w-fit px-2 py-0.5 rounded">
              Scenario 3: Enterprise Client Insists
            </span>
            <span className="font-black text-slate-900 block text-xs">Voluntary Strategic Leverage</span>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              File for voluntary registration. Highly recommended if the annual enterprise deal size exceeds <b>₹50,000/year</b>, allowing you to pass input tax credits to customers.
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-205 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] text-slate-500 font-medium">
            💡 <b>Rule of Thumb</b>: Under current laws, you can legally operate GST-free, keep prices all-inclusive, and leverage secure UPI/Cashfree routing to accept customer service payments.
          </span>
          <span className="text-[10px] font-mono text-slate-400">Section 22/24 CGST Act, 2017</span>
        </div>
      </div>

      {/* Section 8: Live Payment History Logs */}
      <div className="bg-white/60 backdrop-blur-md border border-white/25 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-650" />
            <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-wide">Live Transaction Records & Gateway Status</h3>
          </div>
          <span className="text-[10px] uppercase font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
            Real-time DB Logs
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed mb-4">
          Below are the consolidated payment intents fetched from the backend filesystem database. Any simulation run through <b>Cashfree</b> or <b>Razorpay</b> is persistently logged here to track tier compliance.
        </p>

        {paymentHistory.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
            <Clock className="w-7 h-7 mx-auto mb-2 text-slate-350 stroke-[1.5]" />
            <span className="text-xs font-semibold">No recorded actions detected yet. Elevate your plan to trigger a sandbox transaction.</span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[10px] text-slate-400 uppercase font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">Reference / ID</th>
                  <th className="p-3">Gateway Node</th>
                  <th className="p-3">Selected Plan</th>
                  <th className="p-3">Channel Method</th>
                  <th className="p-3">Settlement Value</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Captured DateTime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paymentHistory.map((intent) => (
                  <tr key={intent.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-805">{intent.id}</td>
                    <td className="p-3">
                      <span className={`inline-block text-[9.5px] font-extrabold px-2 py-0.5 rounded ${
                        intent.gateway === "CASHFREE" 
                          ? "bg-purple-50 text-purple-700 border border-purple-100" 
                          : "bg-blue-50 text-blue-700 border border-blue-100"
                      }`}>
                        {intent.gateway}
                      </span>
                    </td>
                    <td className="p-3 capitalize font-bold text-slate-800">{intent.planId.toLowerCase()}</td>
                    <td className="p-3 font-mono text-[10px]">{intent.method}</td>
                    <td className="p-3 font-black text-slate-900">₹{intent.amount.toLocaleString()}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 text-[9.5px] px-2 py-0.5 rounded font-bold border border-emerald-100">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                        {intent.status}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400 text-[10.5px]">
                      {formatDate(intent.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Simulated Checkout Modal */}
      {selectedPlanForCheckout && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[2000] focus-within:outline-none">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full border border-slate-200 animate-slide-up space-y-4">
            
            {/* Header section based on checkoutState */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div className="space-y-1">
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded font-black uppercase tracking-wider block w-fit">
                  {checkoutStep === "PAYMENT_DONE" ? "Settled Successful" : `Gateway Sandbox Terminal`}
                </span>
                <h3 className="text-base font-black text-slate-900">
                  {checkoutStep === "PAYMENT_DONE" ? "Upgrade Confirmed!" : `Subscribe to ${selectedPlanForCheckout.name}`}
                </h3>
              </div>
              {checkoutStep !== "PAYMENT_DONE" && (
                <button
                  onClick={() => setSelectedPlanForCheckout(null)}
                  className="text-slate-400 hover:text-slate-650 font-bold p-1 cursor-pointer transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {checkoutStep === "SELECT_GATEWAY" && (
              <div className="space-y-4">
                
                {/* Product Summary */}
                <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Target Premium Tier:</span>
                    <span className="font-extrabold text-slate-800">{selectedPlanForCheckout.name} ({billingCycle})</span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-slate-200 pt-2">
                    <span className="text-slate-400">Total Charged Rate:</span>
                    <div className="text-right">
                      {selectedPlanForCheckout.originalMonthly > 0 && (
                        <span className="text-[10px] text-slate-400 line-through mr-1 font-medium">
                          ₹{(billingCycle === "MONTHLY" ? selectedPlanForCheckout.originalMonthly : selectedPlanForCheckout.originalMonthly * 12).toLocaleString()}
                        </span>
                      )}
                      <span className="font-black text-slate-900 text-sm">
                        ₹{(billingCycle === "MONTHLY" ? selectedPlanForCheckout.discountMonthly : selectedPlanForCheckout.annualCost).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Gateway selection (Cashfree vs Razorpay) */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">1. Select Gateway Ingress</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentMode("CASHFREE")}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        paymentMode === "CASHFREE"
                          ? "border-purple-600 bg-purple-50/40 ring-1 ring-purple-100"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 font-sans">
                        <CreditCard className={`w-3.5 h-3.5 ${paymentMode === "CASHFREE" ? "text-purple-600" : "text-slate-400"}`} />
                        <span className="font-bold text-xs text-slate-800">Cashfree</span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-normal">Simulated recurring card check checkout</p>
                    </button>

                    <button
                      onClick={() => setPaymentMode("RAZORPAY")}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        paymentMode === "RAZORPAY"
                          ? "border-blue-600 bg-blue-50/40 ring-1 ring-blue-100"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 font-sans">
                        <ShieldCheck className={`w-3.5 h-3.5 ${paymentMode === "RAZORPAY" ? "text-blue-600" : "text-slate-400"}`} />
                        <span className="font-bold text-xs text-slate-800">Razorpay</span>
                      </div>
                      <p className="text-[9px] text-slate-400 leading-normal">Smart UPI QR & live dynamic verification</p>
                    </button>
                  </div>
                </div>

                {/* Simulated Payment Methods selection */}
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">2. Select Charge Path</span>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
                    {(["CARD", "UPI", "NET_BANKING"] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setCheckoutMethod(method)}
                        className={`py-1.5 text-[10px] font-bold rounded text-center transition-all cursor-pointer ${
                          checkoutMethod === method 
                            ? "bg-white text-slate-800 shadow-xs border border-slate-200/80" 
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {method.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dynamic method detail components */}
                {checkoutMethod === "CARD" && (
                  <div className="space-y-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block tracking-wider">Test Card details (Simulated)</span>
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[9px] text-slate-400 font-bold block mb-0.5">Card Number</label>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full bg-white border border-slate-250 rounded-md px-2 py-1 font-mono focus:outline-none focus:border-indigo-500 text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 font-bold block mb-0.5">Cardholder Name</label>
                        <input
                          type="text"
                          placeholder="E.g., Ramesh Sharma"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          className="w-full bg-white border border-slate-250 rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500 text-slate-800"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] text-slate-400 font-bold block mb-0.5">Expiration</label>
                          <input
                            type="text"
                            placeholder="MM/YY"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            className="w-full bg-white border border-slate-250 rounded-md px-2 py-1 font-mono focus:outline-none focus:border-indigo-500 text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 font-bold block mb-0.5">CVV Code</label>
                          <input
                            type="password"
                            placeholder="***"
                            maxLength={3}
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            className="w-full bg-white border border-slate-250 rounded-md px-2 py-1 font-mono focus:outline-none focus:border-indigo-500 text-slate-800"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-400 font-bold block mb-0.5">Billing ZIP/Postal PIN Code</label>
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="E.g., 800001"
                          value={billingPin}
                          onChange={(e) => setBillingPin(e.target.value)}
                          className="w-full bg-white border border-slate-250 rounded-md px-2 py-1 font-mono focus:outline-none focus:border-indigo-500 text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {checkoutMethod === "UPI" && (
                  <div className="space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[9.5px] uppercase font-bold text-slate-400 tracking-wider">Mock UPI Details</span>
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 rounded px-1.5 font-bold">Recommended</span>
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-400 font-bold block mb-1">Enter UPI VPA Address</label>
                      <input
                        type="text"
                        value={upiVal}
                        onChange={(e) => setUpiVal(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded-md px-2 py-1.5 font-mono focus:outline-none text-slate-800"
                        placeholder="yourname@upi"
                      />
                    </div>

                    <div className="space-y-1 mt-1">
                      <label className="text-[9px] text-slate-400 font-bold block">Quick Launch App Link</label>
                      <div className="grid grid-cols-4 gap-1">
                        {["PhonePe", "Google Pay", "Paytm", "BHIM"].map((app) => (
                          <button
                            key={app}
                            type="button"
                            onClick={() => {
                              setSelectedUpiApp(app);
                              if (app === "PhonePe") setUpiVal("ramesh@ybl");
                              if (app === "Google Pay") setUpiVal("ramesh@oksbi");
                              if (app === "Paytm") setUpiVal("ramesh@paytm");
                              if (app === "BHIM") setUpiVal("ramesh@upi");
                            }}
                            className={`py-1 rounded text-[9.5px] font-bold border transition-all ${
                              selectedUpiApp === app 
                                ? "bg-indigo-50 text-indigo-700 border-indigo-300 font-extrabold" 
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {app.split(" ")[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-150 justify-center">
                      <QrCode className="w-10 h-10 text-slate-700 shrink-0" />
                      <div className="text-[10px]">
                        <span className="font-extrabold text-slate-800 block">Dynamic QR Simulator Connected</span>
                        <span className="text-slate-500">Scan using any standard BHIM payment app at confirmation</span>
                      </div>
                    </div>
                  </div>
                )}

                {checkoutMethod === "NET_BANKING" && (
                  <div className="space-y-2 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block tracking-wider">Simulated NetBanking Terminal</span>
                    <div>
                      <label className="text-[9px] text-slate-400 font-bold block mb-1">Select Bank Provider</label>
                      <select
                        value={selectedBank}
                        onChange={(e) => setSelectedBank(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded-md p-1.5 text-xs text-slate-700 focus:outline-none"
                      >
                        <option value="State Bank of India">State Bank of India (SBI)</option>
                        <option value="HDFC Bank Limited">HDFC Bank Ltd</option>
                        <option value="ICICI Bank Limited">ICICI Bank Ltd</option>
                        <option value="Axis Corporate Banking">Axis Bank</option>
                        <option value="Punjab National Bank">Punjab National Bank</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Additional Billing Contacts (Real Razorpay/Cashfree fields payload) */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1.5 tracking-wider">Gateway Billing Contact Payload</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[8.5px] text-slate-400 font-bold block mb-0.5">Customer Email</label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded px-1.5 py-0.5 font-mono text-[10.5px]"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[8.5px] text-slate-400 font-bold block mb-0.5">Billing Contact Mobile</label>
                      <input
                        type="text"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded px-1.5 py-0.5 font-mono text-[10.5px]"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Disclaimer */}
                <p className="text-[9.5px] text-slate-400 leading-normal text-center">
                  🔐 Sandboxed Environment. <b>No actual funds are drawn</b>. Accepting payments via {paymentMode} will immediately verify structural entitlement, register the transaction, and upgrade your plan.
                </p>

                {/* Clear Action buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPlanForCheckout(null)}
                    className="flex-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="paynow-checkout-btn"
                    onClick={() => {
                      if (!customerEmail.includes("@") || customerPhone.trim().length < 8) {
                        onToast("VALIDATION FAIL", "Please fill in a valid email and phone number for payment processing.", "DEADLINE_REMINDER");
                        return;
                      }
                      if (checkoutMethod === "CARD" || checkoutMethod === "NET_BANKING") {
                        setCheckoutStep("OTP_SCREEN");
                      } else {
                        handleCompletePaymentIntentCapture();
                      }
                    }}
                    disabled={isProcessingPayment}
                    className={`flex-1 text-white font-extrabold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all shadow-md ${
                      paymentMode === "CASHFREE" 
                        ? "bg-purple-600 hover:bg-purple-700 shadow-purple-50" 
                        : "bg-blue-600 hover:bg-blue-700 shadow-blue-50"
                    }`}
                  >
                    <span>Proceed to Pay (₹)</span>
                  </button>
                </div>
              </div>
            )}

            {checkoutStep === "OTP_SCREEN" && (
              <div className="space-y-4">
                <div className="text-center p-3 bg-amber-50 border border-amber-250 rounded-xl space-y-1.5">
                  <span className="font-extrabold text-[9px] bg-amber-100 text-amber-805 block mx-auto w-fit px-2 py-0.5 rounded uppercase tracking-wider">
                    Simulated 3D-Secure Gate (OTP Verification)
                  </span>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    Enter the mock verification code sent to your registered mobile device to authorize this billing checkout.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold block text-center">Enter One-Time Password (OTP)</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="E.g., 123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-32 mx-auto text-center block bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-lg py-2 text-base font-bold font-mono tracking-widest text-slate-800 focus:outline-none"
                  />
                  <span className="text-[9.5px] text-slate-400 block text-center mt-1">Hint: Type any code to pass gateway filters.</span>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCheckoutStep("SELECT_GATEWAY")}
                    className="flex-1 bg-white hover:bg-slate-50 border border-slate-350 text-slate-705 font-bold py-2 rounded-lg text-xs"
                  >
                    Go Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCompletePaymentIntentCapture}
                    disabled={isProcessingPayment}
                    className={`flex-1 font-bold text-white py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 ${
                      paymentMode === "CASHFREE" ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {isProcessingPayment ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Confirming...</span>
                      </>
                    ) : (
                      <span>Verify & Transact (Secure)</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {checkoutStep === "PAYMENT_DONE" && (
              <div className="space-y-4 text-center py-2">
                <div className="w-12 h-12 bg-emerald-50 rounded-full border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 shadow-sm animate-bounce">
                  <CheckCircle className="w-6 h-6 stroke-[2.5]" />
                </div>
                
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-900 text-sm">Payment Processed Successfully!</h4>
                  <p className="text-xs text-slate-500">
                    Your account has been fully updated to the <b>{selectedPlanForCheckout.name} Tier</b>.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-left text-[11px] space-y-2 text-slate-650 font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-normal">Active Plan:</span>
                    <span className="font-bold text-slate-800">{selectedPlanForCheckout.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-normal">Amount Captured:</span>
                    <span className="font-black text-slate-900">
                      ₹{(billingCycle === "MONTHLY" ? selectedPlanForCheckout.discountMonthly : selectedPlanForCheckout.annualCost).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-normal">Payment Gateway:</span>
                    <span className={`font-extrabold px-1.5 py-0.5 rounded border text-[10px] ${
                      paymentMode === "CASHFREE"
                        ? "text-purple-705 bg-purple-50 border-purple-100"
                        : "text-blue-705 bg-blue-50 border-blue-100"
                    }`}>
                      {paymentMode} Secure Sandbox
                    </span>
                  </div>
                  <div className="flex justify-between font-mono text-[9.5px]">
                    <span className="text-slate-400 font-normal">Authorization Reference:</span>
                    <span className="font-black text-slate-700">TA_MOCK_{Math.floor(100000 + Math.random() * 900000)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlanForCheckout(null);
                    onToast("TIER SYNCHRONIZED", "Premium capabilities have been fully hot-swapped and local widgets are refreshed.", "STATUS_CHANGE");
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-2.5 rounded-xl text-xs active:scale-95 transition-all text-center cursor-pointer block"
                >
                  Close & Refresh Invoices
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

