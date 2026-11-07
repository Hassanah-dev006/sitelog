# SiteLog — User Guide

**Tihama Limited (Constructions), Kano**
Daily site reporting · https://sitelog-oy33.onrender.com

Prepared by Hassanat Ajoke Bello · Information Technology Department

---

## What SiteLog is for

Every working day, each active site records what happened: the work done, how many people worked, which machines ran, what materials arrived or were used, and anything that went wrong.

SiteLog replaces writing that on paper. A supervisor fills it in on a phone in about two minutes, and head office can see it the same evening.

**It works without a network connection.** If you have no signal, the report is saved on your phone and sent automatically once you are back in coverage. You do not have to remember to do anything.

---

## Part 1 — For site supervisors

### Signing in the first time

1. Open **https://sitelog-oy33.onrender.com** in your phone's browser
2. Enter the email address and temporary password you were given
3. You will be asked to **set your own password**

> **Why you must change it.** The password you were given was set by an administrator, so somebody else knows it. Until you choose your own, nothing else in the app will open.

Choose something you will remember. A short phrase works better than a short tangle of symbols. At least 8 characters.

> **📸 Screenshot:** the sign-in screen

**Add it to your home screen** so it opens like an app:

- **iPhone:** tap Share, then *Add to Home Screen*
- **Android:** tap the three dots, then *Add to Home screen*

### Filling in a daily report

Tap **New report**.

**Only three things are really needed:**

| Field | What to put |
|---|---|
| **Site** | Choose from the list. You will only see sites you are responsible for. |
| **Date** | Today, unless you are catching up on yesterday. You cannot pick a future date. |
| **What was done today** | A sentence or two. "Foundation work continued on block B. Rebar fixing completed." |

Everything else is optional. Fill in what is useful and leave the rest.

**Weather** — worth recording when it affected the work.

**Delays or problems** — leave blank if there were none.

> **📸 Screenshot:** the report form, top section

### Adding the detail

Below the main fields are four sections, closed until you need them. Tap one to open it.

**Manpower** — tap *Add trade* for each kind of worker:

- Trade: Masons, Labourers, Welders, Carpenters, Electricians…
- How many
- Hours each worked

**Equipment** — tap *Add equipment* for each machine:

- Name
- Hours run
- Whether it was working, idle, or broken down

**Materials** — tap *Add material*:

- Name and unit (bags, tonnes, lengths)
- How much arrived, how much was used

**Incidents** — tap *Add incident* for anything that went wrong:

- Category: safety, equipment, delay, security, other
- How serious: low, medium, high
- What happened

> **Record every safety incident, however small.** A near miss with no injury is still worth recording. It is what stops the same thing happening again with a worse outcome.

**Photos** — tap *Add photo* to attach up to five pictures. Your phone shrinks them before sending, so they go through even on a weak connection.

### Sending it

Tap **Send report**.

**If you have signal**, you will see confirmation that it was sent.

**If you do not have signal**, you will see an orange message saying the report is saved on your phone and will send itself. **This is not an error.** Your report is safe. You can close the app and go home.

> **📸 Screenshot:** the orange "saved on this phone" message

The app sends it by itself when you are next in coverage. If you open the app and see *"1 report is saved on this phone"*, it has not gone yet — it will go as soon as there is a connection.

### Things to know

**One report per site per day.** If you try to send a second report for the same site and date, it will tell you one already exists. Contact your project manager if a report needs changing.

**You can only report on your own sites.** If a site is missing from the list, you have not been assigned to it. Ask an administrator.

**Sending the same report twice is safe.** If the connection fails and it retries, it is still stored only once.

### Changing your password

Tap **Password** at the top of the screen. You need your current password to set a new one.

Changing it signs you out everywhere else — useful if you think someone else has learned it.

---

## Part 2 — For project managers

Everything above applies, plus the following.

### The dashboard

Tap **Dashboard**. It shows:

**Today, at the top**

- How many projects and sites are active
- **How many have reported today**, as a fraction — "5/7" means two sites have not
- Incidents in the last seven days, with high-severity ones called out in orange

**Not yet reported today**

The list of active sites with no report yet, and when each last reported. **This is the part to act on.** A site that has not reported today is a phone call this evening, not a discovery at month end.

If every site has reported, it says so.

**Below that**

- Reports filed per day over the last fortnight
- Manpower by trade
- Equipment hours, with any breakdowns noted

> **📸 Screenshot:** the dashboard, including the outstanding-reports panel

### Downloading reports

Two buttons near the top of the dashboard.

**Weekly report (PDF)** — a formatted document covering the period shown, laid out like the report already circulated. Suitable for printing or emailing.

**Data (Excel)** — six sheets: reports, manpower, equipment, materials, incidents, and a cover sheet saying what the file covers. Use this when you want to work the figures yourself.

Both cover the dates shown at the top of the dashboard, up to 92 days at a time.

### Viewing reports

Tap **Reports** for the most recent submissions across every site. Tap one to see everything in it.

---

## Part 3 — For administrators

Projects, sites and accounts are managed from the command line by the IT Department. There is no screen for this yet — see *Recommended next features* in the handover documentation.

The commands are in the project README, under **Deployment**.

| Task | Command |
|---|---|
| List sites and their ids | `npm run list-sites` |
| Create a project and its sites | `npm run create-project` |
| Create a user account | `npm run create-user` |
| Assign a supervisor to a site | `npm run assign-site` |
| Reset a forgotten password | `npm run reset-password` |

Each prints **LOCAL** or **REMOTE** before it does anything, so you always know which database you are about to change.

---

## If something goes wrong

**The page takes a long time to open.**
The server sleeps when nobody has used it for a while. The first visit of the day can take up to a minute. Wait rather than refreshing — refreshing restarts the wait.

**"Could not reach the server."**
Either you have no connection, or the server is still waking. Wait a moment and try again. If you were sending a report, **it is already saved on your phone** and will go by itself.

**"Incorrect email or password."**
Check the email address first — it is the commonest cause. If you have genuinely forgotten the password, an administrator can reset it.

**A site is missing from my list.**
You have not been assigned to it. An administrator can add you.

**"A report for this site and date already exists."**
Someone has already reported for that site today. Check with your project manager.

**I cannot leave the "Set your password" screen.**
That is deliberate. Choose your own password and the rest of the app opens.

---

## Who to contact

| Question | Who |
|---|---|
| Account, password, new site | Information Technology Department |
| Something about a report's content | Your project manager |
| Something that looks broken | Information Technology Department |

---

*This guide describes SiteLog as handed over in November 2026.*
