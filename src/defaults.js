/**
 * Services proposés au premier lancement.
 * Les URL sont indépendantes de la page GitHub d'origine : l'extension les interroge directement.
 */
export const DEFAULT_SERVICES = [
  { name: 'ActiveCampaign', pageUrl: 'https://status.activecampaign.com', endpoint: 'https://status.activecampaign.com/api/v2/summary.json', provider: 'atlassian', method: 'GET' },
  { name: 'Anthropic / Claude', pageUrl: 'https://status.claude.com', endpoint: 'https://status.claude.com/api/v2/summary.json', provider: 'atlassian', method: 'GET' },
  { name: 'Calendly', pageUrl: 'https://www.calendlystatus.com', endpoint: 'https://www.calendlystatus.com/api/v2/summary.json', provider: 'atlassian', method: 'GET' },
  { name: 'Circle', pageUrl: 'https://status.circle.so', endpoint: 'https://status.circle.so/api/v2/summary.json', provider: 'atlassian', method: 'GET' },
  { name: 'ClickFunnels', pageUrl: 'https://status.clickfunnels.com', endpoint: 'https://status.clickfunnels.com/api/v2/summary.json', provider: 'atlassian', method: 'GET' },
  { name: 'ClickSend', pageUrl: 'https://status.clicksend.com', endpoint: 'https://status.clicksend.com/api/v2/summary.json', provider: 'atlassian', method: 'GET' },
  { name: 'Google Cloud', pageUrl: 'https://status.cloud.google.com', endpoint: 'https://status.cloud.google.com/incidents.json', provider: 'google', method: 'GET' },
  { name: 'Google Workspace', pageUrl: 'https://www.google.com/appsstatus/dashboard', endpoint: 'https://www.google.com/appsstatus/dashboard/incidents.json', provider: 'google', method: 'GET' },
  { name: 'GoHighLevel', pageUrl: 'https://status.gohighlevel.com', endpoint: 'https://api.pulsetic.com/public/status/status.gohighlevel.com', provider: 'pulsetic', method: 'POST' },
  { name: 'Leadpages', pageUrl: 'https://status.leadpages.com', endpoint: 'https://status.leadpages.com/api/v2/summary.json', provider: 'atlassian', method: 'GET' },
  { name: 'Make', pageUrl: 'https://status.make.com', endpoint: 'https://status.make.com/api/v2/summary.json', provider: 'atlassian', method: 'GET' },
  { name: 'ManyChat', pageUrl: 'https://status.manychat.com', endpoint: 'https://status.manychat.com/summary.json', provider: 'instatus', method: 'GET' },
  { name: 'Notion', pageUrl: 'https://www.notion-status.com', endpoint: 'https://www.notion-status.com/api/v2/summary.json', provider: 'atlassian', method: 'GET' },
  { name: 'OpenAI', pageUrl: 'https://status.openai.com', endpoint: 'https://status.openai.com/api/v2/summary.json', provider: 'atlassian', method: 'GET' },
  { name: 'Pipedrive', pageUrl: 'https://status.pipedrive.com', endpoint: 'https://status.pipedrive.com', provider: 'sorryapp', method: 'GET' },
  { name: 'Twilio', pageUrl: 'https://status.twilio.com', endpoint: 'https://status.twilio.com/api/v2/summary.json', provider: 'atlassian', method: 'GET' },
  { name: 'Typeform', pageUrl: 'https://status.typeform.com', endpoint: 'https://status.typeform.com/api/v2/summary.json', provider: 'atlassian', method: 'GET' },
  { name: 'Webflow', pageUrl: 'https://status.webflow.com', endpoint: 'https://status.webflow.com/api/v2/summary.json', provider: 'atlassian', method: 'GET' },
  { name: 'WebinarJam', pageUrl: 'https://status.webinarjam.com', endpoint: 'https://status.webinarjam.com/api/v2/summary.json', provider: 'atlassian', method: 'GET' },
  { name: 'Zapier', pageUrl: 'https://status.zapier.com', endpoint: 'https://status.zapier.com/api/v2/summary.json', provider: 'atlassian', method: 'GET' }
];

export const DEFAULT_SETTINGS = {
  refreshMinutes: 5,
  notificationsEnabled: true,
  viewMode: 'table',
  cardDensity: 'compact',
  sortMode: 'status',
  issuesOnly: false
};

export function instantiateDefaultServices() {
  const now = new Date().toISOString();
  return DEFAULT_SERVICES.map((service) => ({
    ...service,
    id: crypto.randomUUID(),
    enabled: true,
    createdAt: now,
    updatedAt: now
  }));
}
