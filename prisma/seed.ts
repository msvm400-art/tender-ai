import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  console.log("Starting unified database seeding...");

  // Load db.json data
  const dbPath = path.join(__dirname, "../server/data/db.json");
  if (!fs.existsSync(dbPath)) {
    console.error(`Source db.json not found at ${dbPath}. Please run the server first to generate it.`);
    process.exit(1);
  }

  const dbData = JSON.parse(fs.readFileSync(dbPath, "utf-8"));

  // 1. Clear existing records in correct relation order
  console.log("Clearing existing records...");
  await prisma.alert.deleteMany();
  await prisma.tenderMatch.deleteMany();
  await prisma.savedTender.deleteMany();
  await prisma.bidDocument.deleteMany();
  await prisma.documentVault.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.companyProfile.deleteMany();
  await prisma.tender.deleteMany();
  await prisma.user.deleteMany();
  console.log("Database cleared.");

  // 2. Seed Users
  console.log(`Seeding ${dbData.users.length} users...`);
  for (const u of dbData.users) {
    await prisma.user.create({
      data: {
        id: u.id,
        email: u.email,
        passwordHash: u.passwordHash,
        name: u.name,
        phone: u.phone || null,
        plan: u.plan || "FREE",
        role: u.role || "USER",
        emailVerified: u.emailVerified || false,
        verificationToken: u.verificationToken || null,
        resetPasswordToken: u.resetPasswordToken || null,
        resetPasswordExpires: u.resetPasswordExpires ? new Date(u.resetPasswordExpires) : null,
        refreshToken: u.refreshToken || null,
        organizationId: u.organizationId || null,
        createdAt: new Date(u.createdAt),
        updatedAt: new Date(u.updatedAt),
      },
    });
  }

  // 3. Seed Company Profiles
  console.log(`Seeding ${dbData.companyProfiles.length} company profiles...`);
  for (const cp of dbData.companyProfiles) {
    // If the user does not exist in our newly seeded users table (e.g. standard partner profiles), seed a dummy user first to satisfy foreign key constraints.
    const userExists = await prisma.user.findUnique({ where: { id: cp.userId } });
    if (!userExists) {
      await prisma.user.create({
        data: {
          id: cp.userId,
          email: `${cp.userId}@dummypartner.in`,
          passwordHash: "dummy-hash",
          name: cp.companyName,
          role: "USER",
          plan: "FREE",
          emailVerified: true,
        }
      });
    }

    await prisma.companyProfile.create({
      data: {
        id: cp.id,
        userId: cp.userId,
        companyName: cp.companyName,
        registrationNumber: cp.registrationNumber,
        gstNumber: cp.gstNumber,
        panNumber: cp.panNumber,
        annualTurnover: cp.annualTurnover || 0,
        yearsOfExperience: cp.yearsOfExperience || 0,
        categories: cp.categories || [],
        certifications: cp.certifications || [],
        states: cp.states || [],
        msmeRegistered: cp.msmeRegistered || false,
        employeeCount: cp.employeeCount || 0,
        pastProjects: cp.pastProjects || [],
        isActive: cp.isActive !== undefined ? cp.isActive : true,
        createdAt: cp.createdAt ? new Date(cp.createdAt) : new Date(),
        updatedAt: cp.updatedAt ? new Date(cp.updatedAt) : new Date(),
      },
    });
  }

  // 4. Seed Tenders
  console.log(`Seeding ${dbData.tenders.length} tenders...`);
  for (const t of dbData.tenders) {
    await prisma.tender.create({
      data: {
        id: t.id,
        externalId: t.externalId,
        sourcePortal: t.sourcePortal || "OTHER",
        title: t.title,
        department: t.department,
        state: t.state,
        category: t.category,
        subCategory: t.subCategory,
        tenderValue: t.tenderValue || 0,
        emdAmount: t.emdAmount || 0,
        publishedDate: new Date(t.publishedDate),
        bidSubmissionDeadline: new Date(t.bidSubmissionDeadline),
        openingDate: t.openingDate ? new Date(t.openingDate) : null,
        workDescription: t.workDescription || "",
        eligibilityCriteria: t.eligibilityCriteria || {},
        technicalSpecs: t.technicalSpecs || null,
        documents: t.documents || [],
        rawText: t.rawText || "",
        aiSummary: t.aiSummary || null,
        aiEligibilityChecklist: t.aiEligibilityChecklist || null,
        status: t.status || "ACTIVE",
        location: t.location,
        pineconeVectorId: t.pineconeVectorId || null,
        createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date(),
      },
    });
  }

  // 5. Seed Support Tickets
  if (dbData.supportTickets) {
    console.log(`Seeding ${dbData.supportTickets.length} support tickets...`);
    for (const ticket of dbData.supportTickets) {
      await prisma.supportTicket.create({
        data: {
          id: ticket.id,
          userId: ticket.userId,
          subject: ticket.subject,
          message: ticket.message,
          status: ticket.status || "OPEN",
          priority: ticket.priority || "MEDIUM",
          createdAt: new Date(ticket.createdAt),
          updatedAt: new Date(ticket.updatedAt),
        },
      });
    }
  }

  // 6. Seed Payments
  if (dbData.paymentHistory) {
    console.log(`Seeding ${dbData.paymentHistory.length} payments...`);
    for (const pay of dbData.paymentHistory) {
      await prisma.payment.create({
        data: {
          id: pay.id,
          userId: pay.userId,
          amount: pay.amount,
          currency: pay.currency || "INR",
          status: pay.status || "SUCCESSFUL",
          stripePaymentIntentId: pay.stripePaymentIntentId || null,
          invoiceNumber: pay.invoiceNumber || null,
          createdAt: new Date(pay.createdAt),
        },
      });
    }
  }

  console.log("Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
