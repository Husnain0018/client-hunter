import { env } from '../config/env.js';
import type { Lead } from '../types/domain.js';

export const LEAD_COLUMNS = ['Lead_ID', 'Business_Name', 'Category', 'Lead_Type', 'Contact_Channel', 'Website', 'Email', 'Phone', 'WhatsApp_Link', 'Address', 'Country', 'Google_Rating', 'Google_Reviews', 'Google_Maps_URL', 'Lead_Score', 'Priority', 'Estimated_Deal_Value', 'Recommended_Services', 'Weaknesses', 'Analysis_Summary', 'Website_Score', 'Website_Status', 'Website_Issues', 'Website_Images', 'Tech_Stack', 'Facebook_URL', 'Instagram_URL', 'LinkedIn_URL', 'Twitter_URL', 'YouTube_URL', 'TikTok_URL', 'Social_Status', 'Facebook_Last_Post', 'Facebook_Days_Inactive', 'Instagram_Last_Post', 'Instagram_Days_Inactive', 'Competitors', 'Email_Subject', 'Email_Body_Text', 'Email_Body_HTML', 'WhatsApp_Message', 'Approval_Status', 'Email_Status', 'Response_Status', 'Sender_Name', 'Search_Query', 'Created_At', 'Email_Sent_At', 'Follow_Up_1_Date', 'Follow_Up_2_Date', 'Gmail_Thread_ID'];

function sheetIdFromUrl(value: string): string {
  const match = value.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,100})/) || value.match(/^([A-Za-z0-9_-]{20,100})$/);
  if (!match) throw new Error('That does not look like a Google Sheet URL.');
  return match[1];
}

async function sheets(path: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!env.GOOGLE_SHEETS_ACCESS_TOKEN) throw new Error('Google Sheets is not configured on the backend.');
  const response = await fetch(`https://sheets.googleapis.com/v4${path}`, { ...init, headers: { Authorization: `Bearer ${env.GOOGLE_SHEETS_ACCESS_TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) }, signal: init.signal || AbortSignal.timeout(20_000) });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(text) as Record<string, unknown>; } catch { body = { raw: text.slice(0, 300) }; }
  return { status: response.status, body };
}

export async function connectSheet(sheetUrl: string): Promise<{ sheetId: string; tab: string; title: string; url: string; headers: 'ok' | 'created' }> {
  const sheetId = sheetIdFromUrl(sheetUrl);
  const meta = await sheets(`/spreadsheets/${sheetId}?fields=properties.title,sheets.properties.title`);
  if (meta.status !== 200) throw new Error(meta.status === 404 ? 'Google Sheet was not found.' : 'Google Sheet could not be opened. Check the backend Google account permissions.');
  const properties = (meta.body.properties || {}) as Record<string, unknown>;
  const sheetsList = Array.isArray(meta.body.sheets) ? meta.body.sheets as Array<Record<string, unknown>> : [];
  const first = (sheetsList[0]?.properties || {}) as Record<string, unknown>;
  const tab = String(first.title || 'Sheet1');
  const title = String(properties.title || 'Google Sheet');
  const encodedRange = encodeURIComponent(`'${tab.replace(/'/g, "''")}'!A1:AY1`);
  const header = await sheets(`/spreadsheets/${sheetId}/values/${encodedRange}`);
  const values = Array.isArray(header.body.values) ? header.body.values as unknown[] : [];
  const firstRow = Array.isArray(values[0]) ? values[0].map(String) : [];
  if (!firstRow.length) {
    const write = await sheets(`/spreadsheets/${sheetId}/values/${encodedRange}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [LEAD_COLUMNS] }) });
    if (write.status < 200 || write.status >= 300) throw new Error('The sheet is accessible but its header row could not be created.');
    return { sheetId, tab, title, url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`, headers: 'created' };
  }
  if (!firstRow.includes('Lead_ID')) throw new Error('The first row already contains other headings. Connect a blank sheet or add Lead_ID.');
  return { sheetId, tab, title, url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`, headers: 'ok' };
}

export async function appendLeads(sheetId: string, tab: string, leads: Lead[]): Promise<void> {
  if (!leads.length) return;
  const range = encodeURIComponent(`'${tab.replace(/'/g, "''")}'!A:AY`);
  const values = leads.map((lead) => [lead.leadId, lead.businessName, lead.category, lead.leadType, lead.contactChannel, lead.website, lead.email, lead.phone, lead.whatsappLink, lead.address, lead.country, lead.googleRating, lead.googleReviews, lead.googleMapsUrl, lead.leadScore, lead.priority, lead.estimatedDealValue, lead.recommendedServices.join(', '), lead.weaknesses.join(' | '), lead.analysisSummary, lead.websiteScore ?? '', lead.websiteStatus, lead.websiteIssues.join(' | '), lead.websiteImages.join('\n'), lead.techStack.join(', '), lead.social.facebook || '', lead.social.instagram || '', lead.social.linkedin || '', lead.social.twitter || '', lead.social.youtube || '', lead.social.tiktok || '', lead.socialStatus, lead.socialActivity.facebook?.lastPost || '', lead.socialActivity.facebook?.daysInactive ?? '', lead.socialActivity.instagram?.lastPost || '', lead.socialActivity.instagram?.daysInactive ?? '', lead.competitors.map((item) => `${item.name} (${item.rating}, ${item.reviews})`).join(' | '), lead.emailSubject, lead.emailBodyText, lead.emailBodyHtml, lead.whatsappMessage, lead.approvalStatus, lead.emailStatus, lead.responseStatus, lead.senderName, lead.searchQuery, lead.createdAt, lead.emailSentAt, lead.followUp1Date, lead.followUp2Date, lead.gmailThreadId]);
  const result = await sheets(`/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values }) });
  if (result.status < 200 || result.status >= 300) throw new Error('Google Sheet lead sync failed.');
}
