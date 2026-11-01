# SiteLog — Requirements Specification

**Project:** Daily site reporting system
**Client:** Tihama Limited (Constructions), Kano, Nigeria — Information Technology Department
**Author:** Hassanat Ajoke Bello, Software Development Intern
**Supervisor:** Muhammad Umar, IT Manager
**Agreed:** September 2026 · **This version:** November 2026

---

## 1. Background

Tihama Limited runs construction and oil and gas projects across several sites. Each site has a supervisor responsible for recording what happened that day: work completed, how many people worked and in which trades, which machines ran and for how long, what materials arrived or were used, and any safety incidents.

Today that record is written on paper or sent as a message. It reaches head office days later, sometimes not at all.

## 2. The problem, as described by the people who do the work

These came from interviews with the IT Manager and staff who handle site reporting.

| # | Observed problem | Consequence |
|---|---|---|
| P1 | Reports are written by hand at the end of a long day | Detail is thin; some days are skipped |
| P2 | Delivery depends on someone physically carrying paper or remembering to send a message | Information arrives days late |
| P3 | Nobody tracks which sites have reported | A site can go quiet for weeks before anyone notices |
| P4 | Head office re-types reports into a summary | Administrative hours spent on data entry |
| P5 | Historical figures are hard to retrieve | Questions like "how many masons last month" cannot be answered quickly |

## 3. The constraint that shaped everything

**Site supervisors frequently have no usable mobile signal.**

This came out of the interviews and was not in the original brief. It rules out any design that requires a connection at the moment of submission — which is most obvious designs.

Nigeria still carries roughly a third of mobile connections on 2G, and the national regulator has identified hundreds of kilometres of major road with no coverage at all (DataReportal, 2026).

**Consequence for the design:** a report must be recoverable from the device if the network fails, and must send itself later without the user remembering to do anything.

---

## 4. Functional requirements

Prioritised **MoSCoW**. Only *Must* and *Should* items were committed to the internship timeframe.

### Must have

| ID | Requirement | Delivered |
|---|---|---|
| F1 | A site supervisor can submit one daily report per site, from a phone | ✅ |
| F2 | A report captures progress notes, manpower by trade, equipment hours, materials, and incidents | ✅ |
| F3 | A report is retained on the device if submission fails, and sent automatically when the connection returns | ✅ |
| F4 | A report resent after a failure is stored exactly once | ✅ |
| F5 | A supervisor may only submit for sites they are assigned to | ✅ |
| F6 | Management can see all reports across all sites | ✅ |
| F7 | Management can see which active sites have **not** reported on a given day | ✅ |
| F8 | Each user signs in with their own account | ✅ |
| F9 | Three roles: site supervisor, project manager, administrator | ✅ |
| F10 | Administrators can create projects, sites and user accounts | ✅ |

### Should have

| ID | Requirement | Delivered |
|---|---|---|
| F11 | Photographs can be attached to a report as evidence | ✅ |
| F12 | A formatted weekly report can be exported for management | ✅ (PDF) |
| F13 | Underlying data can be exported for independent analysis | ✅ (Excel) |
| F14 | A dashboard showing manpower, equipment use and submission trends | ✅ |
| F15 | Users can change their own password | ✅ |

### Could have — not built

| ID | Requirement | Decision |
|---|---|---|
| F16 | Email notification when a site has not reported | Deferred. The dashboard's outstanding-reports view answers the same need without adding an email service for the IT team to maintain. |
| F17 | A screen for managing users and projects | Deferred. Administration is by command-line script, documented at handover. |
| F18 | Approval workflow for submitted reports | Out of scope. Not raised as a need. |
| F19 | Offline access to historical reports | Out of scope. Supervisors need to *write*, not read, in the field. |

### Won't have

| ID | Requirement | Reason |
|---|---|---|
| F20 | Payroll or costing integration | Different system, different owner |
| F21 | GPS verification of submission location | Raises staff monitoring questions that are the company's to decide, not an intern's |

---

## 5. Non-functional requirements

| ID | Requirement | How it was met |
|---|---|---|
| N1 | Usable on a low-end Android phone over a 2G or 3G connection | Mobile-first interface; total bundle approximately 62 KB gzipped |
| N2 | A report must never be lost because of a network failure | Written to device storage before any network call |
| N3 | Photographs must upload over a weak connection | Compressed on the device: a 4.8 MB camera photo becomes roughly 300 KB |
| N4 | The report form must be quick to complete at the end of a working day | Three fields expected; everything else collapsed until needed |
| N5 | Passwords must never be stored or transmitted in readable form | bcrypt hashing; TLS on every connection |
| N6 | A user's permissions must not be forgeable | Role read from the database on every request, never from the session token |
| N7 | The system must be maintainable by Tihama's IT team after the internship | Widely used technologies, small dependency list, documented handover |
| N8 | Accessible to users with visual or motor impairment | 48px touch targets, 16px minimum text, visible focus, screen-reader labelling |

---

## 6. Users

| Role | Who | Primary need |
|---|---|---|
| Site supervisor | On site, on a phone, poor signal, end of a long day | Record the day quickly and know it is safe |
| Project manager | Head office, desktop | See status across sites; know who has not reported |
| Administrator | IT department | Set up projects, sites and accounts |

## 7. Acceptance criteria

The system was considered ready for handover when:

1. A supervisor can complete and submit a daily report in under three minutes on a phone
2. A report submitted with the device in airplane mode is delivered automatically once connectivity returns
3. The same report resent three times appears once in the database
4. A manager can identify every site that has not reported today, in one view
5. A manager can produce a formatted weekly report without assistance
6. A supervisor cannot read or submit reports for a site they are not assigned to
7. The system runs on infrastructure Tihama controls, not on the intern's machine

All seven were met and verified on the deployed system.

---

## 8. Out of scope

Stated explicitly so the boundary is a decision rather than an omission:

- Financial data, costing, and payroll
- Procurement and supplier management
- Client-facing access
- Integration with existing Tihama systems
- Native mobile applications for iOS or Android

---

## 9. Reference

DataReportal. (2026). *Digital 2026: Nigeria.* https://datareportal.com/reports/digital-2026-nigeria

---

## Document history

| Version | Date | Note |
|---|---|---|
| 0.1 | September 2026 | Requirements gathered from interviews; scope agreed with the IT Manager |
| 1.0 | November 2026 | Consolidated into this document, with delivery status against each requirement |
