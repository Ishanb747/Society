-- CreateEnum
CREATE TYPE "MembershipKind" AS ENUM ('OWNER', 'TENANT', 'FAMILY');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('HELPDESK', 'COMMITTEE', 'DUTY_MANAGER', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('PLUMBING', 'ELECTRICAL', 'LIFT', 'SECURITY', 'HOUSEKEEPING', 'PEST', 'PARKING', 'NOISE', 'OTHER');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ClassifiedBy" AS ENUM ('AI', 'RULE', 'FALLBACK', 'STAFF');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('BILL', 'LATE_FEE', 'PAYMENT', 'ADJUSTMENT', 'CREDIT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('UPI', 'NEFT', 'CHEQUE', 'GATEWAY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('GATEWAY', 'BANK');

-- CreateEnum
CREATE TYPE "BankRowStatus" AS ENUM ('AUTO_POSTED', 'REVIEW', 'UNMATCHED', 'POSTED', 'IGNORED');

-- CreateTable
CREATE TABLE "Flat" (
    "id" TEXT NOT NULL,
    "tower" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "areaSqft" INTEGER NOT NULL,

    CONSTRAINT "Flat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "kind" "MembershipKind" NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "skills" "Category"[],

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "principal" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "period" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "source" "PaymentSource" NOT NULL,
    "utr" TEXT,
    "receiptNo" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnownUpiId" (
    "id" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "vpa" TEXT NOT NULL,

    CONSTRAINT "KnownUpiId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankImport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankRow" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "rowHash" TEXT NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "narration" TEXT NOT NULL,
    "utr" TEXT,
    "vpa" TEXT,
    "status" "BankRowStatus" NOT NULL,
    "suggestedFlatId" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "reasons" JSONB NOT NULL DEFAULT '[]',
    "candidates" JSONB NOT NULL DEFAULT '[]',
    "matchedFlatId" TEXT,
    "paymentId" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "BankRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "flatId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "photoUrl" TEXT,
    "category" "Category" NOT NULL,
    "urgency" "Urgency" NOT NULL,
    "aiCategory" "Category",
    "aiUrgency" "Urgency",
    "aiConfidence" DOUBLE PRECISION,
    "classifiedBy" "ClassifiedBy" NOT NULL,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "safetyEscalated" BOOLEAN NOT NULL DEFAULT false,
    "assigneeId" TEXT,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'NEW',
    "parentId" TEXT,
    "dueBy" TIMESTAMP(3) NOT NULL,
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "rating" INTEGER,
    "reopenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintEvent" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "actorKind" TEXT NOT NULL,
    "actorStaffId" TEXT,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Flat_tower_idx" ON "Flat"("tower");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "Membership_flatId_idx" ON "Membership"("flatId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_flatId_key" ON "Membership"("userId", "flatId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_phone_key" ON "Staff"("phone");

-- CreateIndex
CREATE INDEX "Bill_dueDate_idx" ON "Bill"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_flatId_period_key" ON "Bill"("flatId", "period");

-- CreateIndex
CREATE INDEX "LedgerEntry_flatId_createdAt_idx" ON "LedgerEntry"("flatId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNo_key" ON "Payment"("receiptNo");

-- CreateIndex
CREATE INDEX "Payment_flatId_idx" ON "Payment"("flatId");

-- CreateIndex
CREATE INDEX "Payment_utr_idx" ON "Payment"("utr");

-- CreateIndex
CREATE INDEX "KnownUpiId_vpa_idx" ON "KnownUpiId"("vpa");

-- CreateIndex
CREATE UNIQUE INDEX "KnownUpiId_flatId_vpa_key" ON "KnownUpiId"("flatId", "vpa");

-- CreateIndex
CREATE UNIQUE INDEX "BankImport_fileHash_key" ON "BankImport"("fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "BankRow_rowHash_key" ON "BankRow"("rowHash");

-- CreateIndex
CREATE UNIQUE INDEX "BankRow_paymentId_key" ON "BankRow"("paymentId");

-- CreateIndex
CREATE INDEX "BankRow_status_idx" ON "BankRow"("status");

-- CreateIndex
CREATE INDEX "BankRow_importId_idx" ON "BankRow"("importId");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_seq_key" ON "Complaint"("seq");

-- CreateIndex
CREATE INDEX "Complaint_status_urgency_idx" ON "Complaint"("status", "urgency");

-- CreateIndex
CREATE INDEX "Complaint_flatId_idx" ON "Complaint"("flatId");

-- CreateIndex
CREATE INDEX "Complaint_category_createdAt_idx" ON "Complaint"("category", "createdAt");

-- CreateIndex
CREATE INDEX "ComplaintEvent_complaintId_createdAt_idx" ON "ComplaintEvent"("complaintId", "createdAt");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnownUpiId" ADD CONSTRAINT "KnownUpiId_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankRow" ADD CONSTRAINT "BankRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BankImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankRow" ADD CONSTRAINT "BankRow_matchedFlatId_fkey" FOREIGN KEY ("matchedFlatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankRow" ADD CONSTRAINT "BankRow_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Complaint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintEvent" ADD CONSTRAINT "ComplaintEvent_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintEvent" ADD CONSTRAINT "ComplaintEvent_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
