# School Fee Management, Billing & Financial Reporting Subsystem

This document provides the architecture, data models, payment workflows, and financial reporting specifications for the **Fee Management & Billing Subsystem** in **ShikshaTrack**.

---

## 1. System Overview & Architecture

The fee management subsystem provides a structured financial billing and collection engine for educational institutions. It handles class-based fee catalogs, customizable installment schedules, concession and scholarship adjustments, atomic receipting, and audit-compliant payment reversals.

```
┌────────────────────────────────────────────────────────┐
│                        School                          │
│     (Institutional root tenant isolation boundary)     │
└────────────────────────────────────────────────────────┘
          │
          ├─── 1:N ─── FeeStructure (fee_structures)
          │             ├── name, academicYear, category, totalAmount, frequency
          │             └── classId (optional: school-wide vs grade-specific)
          │
          └─── 1:N ─── StudentFee (student_fees)
                        ├── originalAmount, discountAmount, netAmount, paidAmount, balanceAmount
                        ├── status (PENDING, PARTIAL, PAID, OVERDUE)
                        │
                        ├─── 1:N ─── FeeInstallment (fee_installments)
                        │             ├── installmentNumber, amount, dueDate, paidAmount, balanceAmount
                        │             └── status (PENDING, PARTIAL, PAID)
                        │
                        ├─── 1:N ─── FeeDiscount (fee_discounts)
                        │             ├── discountType (PERCENTAGE, FIXED_AMOUNT), value, amount, reason
                        │             └── approvedById
                        │
                        └─── 1:N ─── FeePayment (fee_payments)
                                      ├── receiptNumber (unique), amountPaid, paymentMethod
                                      ├── transactionReference, paymentDate, isReversed, reversalReason
                                      │
                                      ├─── 1:N ─── PaymentAllocation (payment_allocations)
                                      │             └── allocatedAmount, feeInstallmentId
                                      │
                                      └─── 1:N ─── PaymentReversal (payment_reversals)
                                                    └── reason, reversedAt, approvedById
```

---

## 2. Installment Splitting & Sequential Allocation

### 1. Equal Installment Division Formula
For a fee structure with total amount $T$ divided into $n$ installments ($1 \le n \le 12$):
$$\text{Base Installment } (b) = \lfloor \frac{T}{n} \times 100 \rfloor / 100$$
$$\text{Remainder } (r) = T - (b \times n)$$
- Installment 1 receives $b + r$ to ensure exact rounding.
- Installments 2 through $n$ receive $b$.

### 2. Sequential Payment Allocation
When a payment $P$ is recorded:
1. Outstanding unpaid installments are sorted in ascending order of `installmentNumber` (and `dueDate`).
2. The engine loops through each installment $i$:
   $$\text{Allocation}_i = \min(P_{\text{remaining}}, \text{Balance}_i)$$
   $$\text{Balance}_i \leftarrow \text{Balance}_i - \text{Allocation}_i$$
   $$P_{\text{remaining}} \leftarrow P_{\text{remaining}} - \text{Allocation}_i$$
3. Installment status transitions to `PAID` if $\text{Balance}_i = 0$, else `PARTIAL`.
4. Overpayment check: If $P > \text{Total Account Balance}$, the transaction is rejected atomically.

---

## 3. Concessions & Scholarships

- **Fixed vs. Percentage**: Concessions can be configured as a flat rupee value or percentage of the original fee.
- **Dynamic Rebalancing**: Applying a discount recalculates `netAmount = originalAmount - discountAmount`, sets `balanceAmount = max(0, netAmount - paidAmount)`, and reduces the balances of unpaid installments proportionally without altering historical payments.

---

## 4. Payment Reversals & Audit History

In cases of bank dishonor (bounced cheque, UPI chargeback, or clerical error):
1. Reversal requires the `ADMIN` role with mandatory reason text.
2. In a database transaction:
   - Each `PaymentAllocation` is unwound, restoring installment balances.
   - The `StudentFee.paidAmount` is decremented and `balanceAmount` is restored.
   - `FeePayment` is flagged as `isReversed: true` and an immutable `PaymentReversal` audit entry is created.

---

## 5. API Reference (`/api/v1/fees`)

### Fee Structures
- `POST /structures`: Create a new fee structure (Admin only).
- `GET /structures`: List structures filtered by academic year, class, or category.
- `PUT /structures/:id`: Update structure definition (Admin only).
- `DELETE /structures/:id`: Delete unassigned structure (Admin only).

### Student Billing Accounts
- `POST /assign/student`: Assign a fee plan to an individual student with installments.
- `POST /assign/class`: Bulk assign a fee plan to all active students in a class.
- `POST /accounts/:id/discount`: Apply a concession/scholarship discount to a fee account.
- `GET /students/:studentId/statement`: Comprehensive student fee ledger, installment status, and receipts.

### Payments & Receipts
- `POST /payments`: Record a fee payment (Cash, Bank Transfer, UPI, Cheque), generate receipt number, and allocate sequentially.
- `POST /payments/:id/reverse`: Reverse a payment and restore account balances (Admin only).
- `GET /receipts/:receiptNumber`: Detailed official payment receipt data for printing/download.

### Analytics & Reports
- `GET /overdue`: Real-time queue of past-due installments with days overdue and guardian contacts.
- `GET /summary`: High-level financial KPIs (Billed, Collected, Outstanding, Overdue, Collection Rate %).
- `GET /reports/classes`: Class-wise fee collection benchmark report.
- `GET /export?type=overdue|payments|classes`: RFC-4180 compliant CSV stream.
