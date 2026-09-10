# Overview

Build a small full-stack progress-billing desk for a general contractor.
Northline files pay applications against a living schedule of values.
Owners release certified papers to the card desk. An architect stamps an
exact net.
Subs file their own invoices. Payroll, insurance, and a notary each do one
job that the others cannot.

Money fields in artifacts are whole US dollars, so `40000` means $40,000.00.
Prefer the JSON under `/assets/artifacts/` when present — it carries stable
ids. Copy those files into `/app` and load that copy on first boot.
`/assets` is only there while you build.
