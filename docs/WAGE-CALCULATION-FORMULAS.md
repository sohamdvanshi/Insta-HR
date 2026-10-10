# Attendance and Wage Calculation Formulas

This document describes the calculations implemented in Insta-HR's attendance-based wage register. The wage rules come from the supplied **Wage Register March 23.xls**, with attendance imported from the separate attendance `.xlsx` template.

The wage rate is a **daily rate**, and manually entered earnings/deductions are **amounts for the employee's entire payroll period** unless explicitly stated otherwise.

## 1. Attendance → payable days

Daily attendance codes are trimmed and converted to uppercase. `H` is normalized to `PH` during import.

| Code | Treatment | Adds to payable days? |
| --- | --- | --- |
| P | Present | Yes: 1 day |
| PH | Public holiday | Yes: 1 day |
| H | Converted to PH | Yes: 1 day |
| WO | Weekly off | No |
| A | Absent | No |
| CL, CO, LWP, OD, PL, SL, HD | Accepted additional attendance codes | No |
| Blank | Incomplete attendance | No; blocks approval |

```text
Present Days = COUNT(P)
Public Holiday Days = COUNT(PH after H → PH normalization)
Weekly Offs = COUNT(WO)
Payable Days = Present Days + Public Holiday Days
```

`A` is read from the uploaded daily cells but is not subtracted a second time. Its effect is already reflected in the reduced payable-day count. There is no additional automatic absence deduction.

The **No. of Days worked** column in the wage export contains this payable-day count, including public holidays. It is not strictly a count of days physically worked.

### Attendance example

```text
25 present days + 1 public holiday + 4 weekly offs + 1 absence
Payable days = 25 + 1 = 26
```

Printed month headings and Excel summary totals are not used to calculate wages. The actual date headers establish the payroll month, and daily codes establish the count.

## 2. Earnings

### Basic earnings

```text
Basic = ROUND(Daily Wage Rate × Payable Days, 2)
```

The daily rate should not be entered as a monthly salary. The system does not automatically divide a monthly salary by calendar days or by 26.

### Overtime earnings

```text
Overtime Earnings = ROUND((Daily Wage Rate ÷ 4) × Overtime Hours, 2)
```

The divisor **4** comes directly from the supplied wage workbook. Overtime hours are entered manually; P/A attendance codes alone do not identify overtime hours.

### Total earnings

```text
Total Earnings = ROUND(
    Basic
  + Special Basic
  + DA
  + Overtime Earnings
  + HRA
  + Other Earnings,
  2
)
```

Special Basic, DA, HRA and Other Earnings are manual period amounts. They are not automatically multiplied by payable days, prorated or converted from percentages.

## 3. Employee deductions

### PF

```text
PF Calculation Base = MIN(Basic, 15000)
Employee PF = ROUND(PF Calculation Base × 0.12, 2)
```

The cap applies to **Basic earnings**, not the daily wage rate or Total Earnings. This formula's maximum calculated employee PF is ₹1,800 per register row.

The source workbook expresses this through two IF branches:

```excel
=IF(H18>=15000,15000)*0.12+IF(H18<15000,H18)*0.12
```

The portal uses the equivalent `MIN(Basic,15000)*0.12` calculation, with rounding to paise.

### ESIC

```text
Employee ESIC = ROUND(Total Earnings × 0.0075, 0)
```

`0.0075` means **0.75%**. ESIC rounds to the nearest whole rupee, unlike the other monetary components which round to two decimal places.

### Total deductions

```text
Total Deductions = ROUND(
    Employee PF
  + Employee ESIC
  + Society
  + Income Tax
  + Insurance
  + Other Deductions
  + Recoveries,
  2
)
```

Society, Income Tax, Insurance, Other Deductions and Recoveries are manually entered period amounts. The system does not calculate tax slabs or infer these amounts from attendance.

## 4. Net payment

```text
Net Payment = ROUND(Total Earnings − Total Deductions, 2)
```

A negative net amount can appear while editing a draft, but approval is rejected until it is corrected.

## 5. Employer contribution

```text
Employer PF / Welfare Contribution = Employer-entered amount
```

This amount is displayed/exported separately. It is not included in employee earnings, employee deductions or Net Payment. The system does not automatically derive an employer contribution percentage.

## 6. Manual inputs and derived outputs

| Manual numeric input | Field in code | Unit |
| --- | --- | --- |
| Daily wage rate | rate | ₹ per payable day |
| Overtime hours | overtimeHours | Hours for the period |
| Special Basic | specialBasic | ₹ for the period |
| DA | da | ₹ for the period |
| HRA | hra | ₹ for the period |
| Other earnings | otherEarnings | ₹ for the period |
| Society | society | ₹ deduction for the period |
| Income Tax | incomeTax | ₹ deduction for the period |
| Insurance | insurance | ₹ deduction for the period |
| Other deductions | otherDeductions | ₹ deduction for the period |
| Recoveries | recoveries | ₹ deduction for the period |
| Employer PF/welfare contribution | employerContribution | ₹ for the period; separate |

Derived fields: `presentDays`, `holidayDays`, `weeklyOffs`, `payableDays`, `basic`, `overtime`, `earnings`, `pf`, `esic`, `deductions`, `net`.

UAN, wage group, receipt/bank transaction ID, payment date and remarks are manually entered metadata, not calculated amounts.

## 7. Excel export formula mapping

The generated workbook contains:

- **FORM D- ATTENDENCE**: employee IDs, names, normalized daily codes and a payable-days formula.
- **FORM B - WAGE**: inputs, calculated wage fields and register totals.

The following example is for the **first employee in a 31-day month**. Their attendance is on row 2; their wage calculation is on row 5. Subsequent employee rows and shorter-month column references are generated automatically.

### Attendance sheet

Daily codes occupy `C2:AG2`; payable days are in `AH2`.

```excel
=COUNTIF(C2:AG2,"P")+COUNTIF(C2:AG2,"PH")
```

The exporter writes imported H holidays as PH. If editing the downloaded workbook, use PH for public holidays so this exported formula counts them.

### Wage sheet

| Column | Field | Formula / input for first employee |
| --- | --- | --- |
| E | Daily wage rate | Manual input |
| F | Payable days | `='FORM D- ATTENDENCE'!AH2` |
| G | Overtime hours | Manual input |
| H | Basic | `=ROUND(E5*F5,2)` |
| I | Special Basic | Manual input |
| J | DA | Manual input |
| K | Overtime earnings | `=ROUND(E5/4*G5,2)` |
| L | HRA | Manual input |
| M | Other earnings | Manual input |
| N | Total earnings | `=ROUND(SUM(H5:M5),2)` |
| O | Employee PF | `=ROUND(MIN(H5,15000)*0.12,2)` |
| P | Employee ESIC | `=ROUND(N5*0.75%,0)` |
| Q | Society | Manual input |
| R | Income Tax | Manual input |
| S | Insurance | Manual input |
| T | Other deductions | Manual input |
| U | Recoveries | Manual input |
| V | Total deductions | `=ROUND(SUM(O5:U5),2)` |
| W | Net payment | `=ROUND(N5-V5,2)` |
| X | Employer PF/welfare contribution | Manual input |

### Register totals

The final row sums each numeric column across employees. For example, seven employees occupy wage rows 5–11:

```excel
Total Earnings:   =SUM(N5:N11)
Total Deductions: =SUM(V5:V11)
Total Net:        =SUM(W5:W11)
Employer Share:   =SUM(X5:X11)
```

The portal's displayed totals cover **all employees in the open register**, even if a wage-group filter hides some rows.

## 8. Worked examples

### Example A: supplied wage workbook values

| Item | Calculation | Amount |
| --- | --- | ---: |
| Daily rate | Manual | ₹595.00 |
| Payable days | Attendance | 26 |
| Basic | 595 × 26 | ₹15,470.00 |
| Overtime and other earnings | Zero | ₹0.00 |
| Total earnings | Basic only | ₹15,470.00 |
| PF | MIN(15470,15000) × 12% | ₹1,800.00 |
| ESIC | ROUND(15470 × 0.75%,0) | ₹116.00 |
| Other deductions | Zero | ₹0.00 |
| Total deductions | 1800 + 116 | ₹1,916.00 |
| Net payment | 15470 − 1916 | **₹13,554.00** |

### Example B: overtime, allowances and recoveries

Inputs: daily rate ₹595; payable days 20; overtime 8 hours; Special Basic ₹100; DA ₹50; HRA ₹200; Other Earnings ₹25; Society ₹10; Income Tax ₹20; Insurance ₹30; Other Deductions ₹40; Recoveries ₹50; employer contribution ₹800.

```text
Basic = 595 × 20 = 11,900.00
Overtime = 595 ÷ 4 × 8 = 1,190.00
Total Earnings = 11,900 + 1,190 + 100 + 50 + 200 + 25 = 13,465.00
PF = 11,900 × 0.12 = 1,428.00
ESIC = ROUND(13,465 × 0.0075, 0) = 101.00
Total Deductions = 1,428 + 101 + 10 + 20 + 30 + 40 + 50 = 1,679.00
Net Payment = 13,465 − 1,679 = 11,786.00
Employer Contribution = 800.00 (separate; does not change Net Payment)
```

## 9. Groups, saving and approval

1. Select employees and enter shared inputs.
2. Click **Apply to selected** to update the browser draft. Blank bulk fields leave individual values unchanged; explicit zero clears an amount.
3. Each employee's earnings are calculated using their own payable days. A shared overtime value applies the same hours to every selected employee.
4. Use **View / edit** for individual overrides, then click **Save wages**.
5. The backend recalculates all derived values instead of trusting browser totals. Unsaved changes block export and approval.
6. **Export Excel with formulas** downloads the saved draft or approved register.
7. **Approve and lock** requires positive daily rates, nonnegative net amounts and no blank attendance codes. It locks further changes; it does not transfer money.

Changing a downloaded Excel file does not update the portal. Backend calculations determine the saved register; the export includes formulas plus cached results for spreadsheet review.

## 10. Rounding and scope

Numeric inputs must be nonnegative and have at most two decimal places. Blank individual numeric inputs become zero. Monetary components and totals round to two decimals; ESIC rounds to a whole rupee. The backend uses JavaScript `Math.round`; exported formulas use Excel `ROUND`.

These are the fixed rules of the supplied workbook. Eligibility rules, alternative contribution bases, tax slabs, monthly-salary proration and additional paid-leave policies are not automatically applied.

## Implementation references

- `backend/src/services/wageCalculation.js`: input validation, attendance normalization and authoritative wage calculation.
- `backend/src/services/attendanceWorkbook.js`: attendance import and month/date checks.
- `backend/src/services/wageExport.js`: Excel formulas, cached results and totals.
- `backend/src/controllers/wageRegister.controller.js`: saving, approval, ownership and audit entries.
- `backend/test/wages.test.js`: formula and workbook tests.
- `backend/test/wages-api.test.js`: save, access and approval regression tests.
