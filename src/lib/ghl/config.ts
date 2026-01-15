export const GHL_CONFIG = {
    API_URL: 'https://services.leadconnectorhq.com',
    API_VERSION: '2021-07-28',
    // Locations can be loaded from DB or Env if single location
    LOCATION_ID: process.env.GHL_LOCATION_ID,
    ACCESS_TOKEN: process.env.GHL_ACCESS_TOKEN,
}

export const GHL_EVENTS = {
    CONTACT_CREATED: 'ContactCreated',
    CONTACT_UPDATED: 'ContactUpdated',
    CONTACT_TAG_CREATED: 'ContactTagCreated',
    OPPORTUNITY_STATUS_UPDATE: 'OpportunityStatusUpdate',
}
