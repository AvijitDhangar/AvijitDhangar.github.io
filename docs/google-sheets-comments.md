# Google Sheets & Apps Script Native Commenting System

A 100% free, private, serverless commenting backend for your website that stores comments in a private Google Sheet and lets you moderate them without modifying any code.

---

## 1. Architecture & Technical Overview

### How it works
```
┌────────────────────────┐                   ┌──────────────────────────────┐
│  Visitor's Browser     │  GET (fetch)      │  Google Apps Script Web App  │
│  (Astro Static Site)   ├──────────────────►│  (doGet / doPost)            │
│                        │◄──────────────────┤  Execute as: You (Owner)     │
│  - Native DOM (No Form)│  JSON Response    └──────────────┬───────────────┘
│  - Sanitized text      │                                  │
│  - Async / Non-blocking│                                  │ Private API Read/Write
│  - Honeypot anti-spam  │                                  ▼
└────────────────────────┘                   ┌──────────────────────────────┐
                                             │  Private Google Spreadsheet  │
                                             │  - Sheet tab: "Comments"     │
                                             │  - Moderation: Status column │
                                             └──────────────────────────────┘
```

1. **Frontend**: Native HTML/CSS/JavaScript component ([src/components/Comments.astro](file:///home/avi_d/Coding/avijit-world/src/components/Comments.astro)) styled to match your site. Zero iframes, zero external authentication, zero dependencies.
2. **Backend**: A Google Apps Script Web App running on Google's serverless infrastructure. It handles validation, sanitization, concurrency locks, and returns structured JSON via `ContentService`.
3. **Database**: A private Google Sheet accessible only to your Google account. Comments default to `Pending` until you mark them `Approved`.

---

### Important Technical Details & Google Limitations

- **CORS & Preflight Requests**:
  Google Apps Script does **not** support HTTP `OPTIONS` preflight requests. If a browser sends `Content-Type: application/json` or custom headers, modern browsers send an `OPTIONS` request first, which causes Google to return a CORS failure.
  *Our Solution*: The frontend submits requests using `Content-Type: text/plain;charset=utf-8` with a stringified JSON body. Because `text/plain` is considered a simple CORS request by the W3C spec, browsers do not send an `OPTIONS` preflight, allowing the request and Google's `302 Moved Temporarily` redirect to complete cleanly.
- **Privacy & Permissions**:
  The Web App is deployed with **"Execute as: Me"** and **"Who has access: Anyone"**.
  - **"Execute as: Me"**: The script runs with your account permissions, allowing it to read and write to your private Google Sheet.
  - **"Who has access: Anyone"**: Anyone on the web can invoke the script endpoint without needing a Google sign-in.
  - **Your spreadsheet remains 100% private**: Website visitors never see your Google Sheet ID, file link, or Google account details.
- **Concurrency & LockService**:
  To prevent data corruption if multiple comments arrive at the exact same millisecond, `Code.gs` uses `LockService.getScriptLock()` with a 15-second timeout.
- **Rate Limits & Quota**:
  Google provides generous free-tier limits (20,000 URL Fetch calls/day and up to 6 minutes script execution time per call). For a personal site with tens to hundreds of comments a week, you will use less than 0.1% of Google's free allowance.

---

## 2. Step-by-Step Setup Guide

### Step 1: Create Your Private Google Sheet
1. Go to [sheets.google.com](https://sheets.google.com) and create a **Blank spreadsheet**.
2. Name the spreadsheet **`Avijit World Comments`** (in the top-left title).
3. Ensure the active tab at the bottom is named **`Comments`** (double-click the tab named "Sheet1" and rename it to `Comments`).
4. (Optional) In row 1, enter the column headers:
   - **A1**: `Comment ID`
   - **B1**: `Chapter ID`
   - **C1**: `Username`
   - **D1**: `Comment`
   - **E1**: `Timestamp`
   - **F1**: `Status`
   *(If you leave it blank, the script will automatically create these headers upon first run!)*

---

### Step 2: Open the Apps Script Editor
1. In your Google Sheet, click **Extensions** in the top menu bar.
2. Select **Apps Script**.
3. A new tab opens with the Google Apps Script code editor.
4. Name the project **`Comments-Backend`** (top-left).

---

### Step 3: Paste the Backend Code & Set Spreadsheet ID
1. Open the file [google-apps-script/Code.gs](file:///home/avi_d/Coding/avijit-world/google-apps-script/Code.gs) located in this workspace.
2. Select all text and copy it.
3. In the Google Apps Script editor, delete any existing placeholder code in `Code.gs` and paste the copied code.
4. Copy your Google Sheet ID from your browser's address bar:
   `https://docs.google.com/spreadsheets/d/`**`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`**`/edit`
5. At the top of `Code.gs`, replace `"YOUR_SPREADSHEET_ID_HERE"` with your copied Sheet ID:
   ```javascript
   const SPREADSHEET_ID = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms";
   ```
   *(The script directly calls `SpreadsheetApp.openById(SPREADSHEET_ID)` and `spreadsheet.getSheetByName("Comments")`)*.
6. Press `Ctrl + S` (or `Cmd + S`) to save.

---

### Step 4: Deploy as a Web App
1. In the top-right corner of the Apps Script editor, click the blue **Deploy** button and choose **New deployment**.
2. Click the gear icon (⚙️) next to *Select type* and choose **Web app**.
3. Configure the fields:
   - **Description**: `Comments API v1`
   - **Execute as**: `Me (your_email@gmail.com)` *(critical!)*
   - **Who has access**: `Anyone` *(critical!)*
4. Click **Deploy**.

#### First-time Authorization Prompt
5. Google will ask you to authorize access so the script can manage the sheet on your behalf:
   - Click **Authorize access**.
   - Choose your Google account.
   - If Google shows *"Google hasn’t verified this app"*, click **Advanced** (at the bottom-left), then click **Go to Comments-Backend (unsafe)**.
   - Click **Allow**.
6. When deployment finishes, Google displays the **Web app URL**:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```
   > [!IMPORTANT]
   > Copy the **Web app URL** (which ends in `/exec`). Do **NOT** copy the Spreadsheet URL or the Library ID.

---

### Step 5: Connect the URL to Your Website
1. Open [src/data/site.mjs](file:///home/avi_d/Coding/avijit-world/src/data/site.mjs).
2. Find `comments.googleSheets.webAppUrl` (around line 77) and paste your copied URL:
   ```javascript
   comments: {
     enabled: true,
     provider: 'google-sheets',
     googleSheets: {
       webAppUrl: 'https://script.google.com/macros/s/AKfycbx.../exec',
     },
     // ...
   }
   ```
3. Save the file.

---

## 3. How to Use & Test

### Universal Usage Across Your Website
You can use `<Comments />` anywhere on your site. Pass any unique identifier using `id="..."`, `itemId="..."`, or `chapterId="..."`:

```astro
---
import Comments from '../components/Comments.astro';
---

<!-- For a digital garden note or essay -->
<Comments id="my-windows-isnt-like-yours" />

<!-- For a story chapter -->
<Comments chapterId="triggered-lives-chapter-1" />

<!-- For a workshop project or curiosity topic -->
<Comments itemId="colour-science" />

<!-- For a general guestbook or contact page with custom titles -->
<Comments 
  id="general" 
  title="Reflections & Connections" 
  description="Leave a question, reaction, or note on this topic." 
/>
```
/>
```

### Testing a Submission
1. Open your website in your browser.
2. Scroll to the comment section.
3. Type an optional name (or leave blank for "Anonymous"), type a test comment, and click **Submit Comment**.
4. You will see:
   > *"✓ Thank you! Your reflection has been received and will appear once reviewed by the author."*

---

## 4. Moderating Comments

1. Open your Google Sheet (**`Avijit World Comments`**).
2. You will see your submitted comment in a new row with column `Status` set to `Pending`.
3. To approve it:
   - Double click the **Status** cell and type **`Approved`** (case-insensitive).
4. Refresh your website page:
   - The comment will immediately render publicly in chronological order!
5. To reject or remove a comment:
   - Change Status to **`Rejected`** or delete the row.

> [!TIP]
> **Pro Tip (Dropdown Menus)**:
> In your Google Sheet, select Column F (Status), click **Insert** > **Drop-down**, and add 3 chip options:
> - `Pending` (Yellow)
> - `Approved` (Green)
> - `Rejected` (Red)
> Now you can approve comments with a single click from your phone or laptop!

---

## 5. Troubleshooting & FAQ

- **Q: Submissions fail with "Network error" or "Script error"**
  - Make sure the Web App was deployed with **"Who has access: Anyone"**. If set to "Only myself", visitors cannot post.
  - Make sure you copied the Web App URL (ending in `/exec`), not the Apps Script project editor URL.
- **Q: I updated the Google Apps Script code, but changes aren't taking effect**
  - Whenever you edit `Code.gs` in Apps Script, you must click **Deploy** > **Manage deployments** > Click the pencil icon (Edit) > Select **Version: New version** > Click **Deploy**. Google Apps Script only runs the published version!
- **Q: Can visitors see the Google Sheet?**
  - No. The Google Sheet is private. Only you can access it. Visitors only talk to the Web App JSON endpoint.
