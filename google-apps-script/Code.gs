/**
 * Google Apps Script - Universal Commenting System Backend
 * --------------------------------------------------------
 * Connects to your private Google Sheet to store and retrieve comments
 * for any content: notes, essays, book chapters, curiosity topics,
 * workshop projects, or general pages.
 * 
 * Columns in Google Sheet (Sheet tab "Comments"):
 * Col A: Comment ID
 * Col B: Item ID (e.g. note slug, chapter-1, workshop, photography, general)
 * Col C: Username
 * Col D: Comment
 * Col E: Timestamp
 * Col F: Status (Pending | Approved | Rejected)
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// Paste your Google Sheet ID (or full Google Sheet URL) here:
// Examples:
// - Just the ID: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
// - Or the full URL: "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE";

const CONFIG = {
  SHEET_NAME: 'Comments',
  MAX_COMMENT_LENGTH: 2000,
  MAX_USERNAME_LENGTH: 40,
  DEFAULT_USERNAME: 'Anonymous',
  ALLOWED_ID_REGEX: /^[a-zA-Z0-9_\-\.\/]{1,120}$/,
  LOCK_TIMEOUT_MS: 15000, // 15 seconds lock wait for concurrent writes
};

/**
 * Robust helper to open the spreadsheet
 * Handles raw IDs, full Google Sheet URLs, and active container fallback.
 */
function getSpreadsheet() {
  let raw = (typeof SPREADSHEET_ID !== 'undefined' ? SPREADSHEET_ID : '').trim();

  // If the user pasted the entire Google Sheet URL, extract the ID
  const urlMatch = raw.match(/\/d\/([a-zA-Z0-9_\-]+)/);
  if (urlMatch && urlMatch[1]) {
    raw = urlMatch[1];
  }

  // 1. Try opening by ID
  if (raw && raw !== "YOUR_SPREADSHEET_ID_HERE") {
    try {
      const ss = SpreadsheetApp.openById(raw);
      if (ss) return ss;
    } catch (e) {
      console.warn("Could not openById: " + e.message);
    }
  }

  // 2. Try opening by URL (if raw string looks like a web URL)
  if (raw.startsWith("http")) {
    try {
      const ss = SpreadsheetApp.openByUrl(raw);
      if (ss) return ss;
    } catch (e) {}
  }

  // 3. Fallback to active spreadsheet (if script was created via Extensions > Apps Script)
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}

  throw new Error(
    "Could not access spreadsheet. In Code.gs line 24, replace 'YOUR_SPREADSHEET_ID_HERE' with your Google Sheet ID (or full Sheet URL), then Deploy > Manage deployments > New version > Deploy."
  );
}

/**
 * Robust helper to get the "Comments" tab
 * Auto-creates the tab and header row if not present.
 */
function getCommentsSheet() {
  const spreadsheet = getSpreadsheet();
  
  // 1. Try exact name "Comments"
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  
  // 2. Try case-insensitive search
  if (!sheet) {
    const allSheets = spreadsheet.getSheets();
    for (let i = 0; i < allSheets.length; i++) {
      if (allSheets[i].getName().trim().toLowerCase() === CONFIG.SHEET_NAME.toLowerCase()) {
        sheet = allSheets[i];
        break;
      }
    }
  }

  // 3. If still not found, create "Comments" or use the first sheet
  if (!sheet) {
    try {
      sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
    } catch (err) {
      sheet = spreadsheet.getSheets()[0];
    }
  }

  // Ensure header row exists: Comment ID | Item ID | Username | Comment | Timestamp | Status
  if (sheet.getLastRow() === 0) {
    const headers = ['Comment ID', 'Item ID', 'Username', 'Comment', 'Timestamp', 'Status'];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Handle HTTP GET Requests:
 * Used by the website to fetch approved comments for a specific item/note/page.
 * Query format: ?action=get&itemId=system-of-learning
 */
function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action || 'get';
    const itemId = (params.itemId || params.pageId || params.id || params.chapterId || '').trim();

    if (action === 'get') {
      if (!itemId) {
        return createJsonResponse({ error: 'Missing itemId parameter' }, 400);
      }

      if (!CONFIG.ALLOWED_ID_REGEX.test(itemId)) {
        return createJsonResponse({ error: 'Invalid itemId format' }, 400);
      }

      const comments = getApprovedComments(itemId);
      return createJsonResponse({
        success: true,
        itemId: itemId,
        count: comments.length,
        comments: comments
      });
    }

    return createJsonResponse({ error: 'Unknown action' }, 400);
  } catch (err) {
    return createJsonResponse({ error: 'Server error: ' + err.toString() }, 500);
  }
}

/**
 * Handle HTTP POST Requests:
 * Used by the website to submit a new comment.
 * Payload JSON: { itemId, username, comment, honeypot }
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  
  try {
    const hasLock = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
    if (!hasLock) {
      return createJsonResponse({ error: 'Server busy. Please try submitting again in a moment.' }, 429);
    }

    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ error: 'No data received' }, 400);
    }

    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return createJsonResponse({ error: 'Invalid JSON payload' }, 400);
    }

    // 1. Honeypot check (anti-bot trap)
    if (payload.honeypot && payload.honeypot.trim() !== '') {
      return createJsonResponse({ success: true, message: 'Comment submitted for review' });
    }

    // 2. Validate Item / Content ID
    const itemId = (payload.itemId || payload.pageId || payload.id || payload.chapterId || '').trim();
    if (!itemId) {
      return createJsonResponse({ error: 'Item ID is required' }, 400);
    }
    if (!CONFIG.ALLOWED_ID_REGEX.test(itemId)) {
      return createJsonResponse({ error: 'Invalid Item ID format' }, 400);
    }

    // 3. Validate Comment text
    const rawComment = (payload.comment || '').trim();
    if (!rawComment) {
      return createJsonResponse({ error: 'Comment cannot be empty' }, 400);
    }
    if (rawComment.length > CONFIG.MAX_COMMENT_LENGTH) {
      return createJsonResponse({
        error: 'Comment exceeds maximum allowed length of ' + CONFIG.MAX_COMMENT_LENGTH + ' characters.'
      }, 400);
    }

    // 4. Validate Username
    let rawUsername = (payload.username || '').trim();
    if (!rawUsername) {
      rawUsername = CONFIG.DEFAULT_USERNAME;
    } else if (rawUsername.length > CONFIG.MAX_USERNAME_LENGTH) {
      return createJsonResponse({
        error: 'Username exceeds maximum allowed length of ' + CONFIG.MAX_USERNAME_LENGTH + ' characters.'
      }, 400);
    }

    // 5. Sanitize strings (strip dangerous HTML characters)
    const sanitizedUsername = sanitizeText(rawUsername);
    const sanitizedComment = sanitizeText(rawComment);

    // 6. Generate unique ID & Timestamp
    const commentId = 'c_' + Utilities.getUuid().substring(0, 8) + '_' + Date.now();
    const timestamp = new Date().toISOString();
    const status = 'Pending'; // All comments are Pending by default

    // 7. Get sheet and append row
    const sheet = getCommentsSheet();

    sheet.appendRow([
      commentId,
      itemId,
      sanitizedUsername,
      sanitizedComment,
      timestamp,
      status
    ]);

    return createJsonResponse({
      success: true,
      message: 'Comment submitted successfully! It will appear once approved by the author.',
      comment: {
        id: commentId,
        itemId: itemId,
        username: sanitizedUsername,
        timestamp: timestamp,
        status: status
      }
    });

  } catch (err) {
    return createJsonResponse({ error: 'Failed to save comment: ' + err.toString() }, 500);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Fetch approved comments for a specific item (note, chapter, project, page)
 */
function getApprovedComments(itemId) {
  const sheet = getCommentsSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Only header row

  const results = [];

  // Row 0 is header: [Comment ID, Item ID, Username, Comment, Timestamp, Status]
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rCommentId = String(row[0] || '').trim();
    const rItemId = String(row[1] || '').trim();
    const rUsername = String(row[2] || '').trim();
    const rComment = String(row[3] || '').trim();
    const rTimestamp = row[4];
    const rStatus = String(row[5] || '').trim().toLowerCase();

    // Check match and approval
    if (rItemId === itemId && rStatus === 'approved') {
      let formattedTime = '';
      if (rTimestamp instanceof Date) {
        formattedTime = rTimestamp.toISOString();
      } else {
        formattedTime = String(rTimestamp || '');
      }

      results.push({
        id: rCommentId,
        username: rUsername || CONFIG.DEFAULT_USERNAME,
        comment: rComment,
        timestamp: formattedTime
      });
    }
  }

  // Sort chronologically (oldest first)
  results.sort(function(a, b) {
    return new Date(a.timestamp) - new Date(b.timestamp);
  });

  return results;
}

/**
 * Escape HTML to prevent stored XSS
 */
function sanitizeText(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Return JSON response via ContentService
 */
function createJsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
