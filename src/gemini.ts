import fetch from 'node-fetch';

export default class GeminiApi {
  static BASE_URL = 'api.gemini.yahoo.com';
  static MAX_RETRIES = 5;

  private static instance: GeminiApi;
  public static getInstance(): GeminiApi {
    if (!GeminiApi.instance) {
      GeminiApi.instance = new GeminiApi();
    }
    return GeminiApi.instance;
  }

  private accessToken: string;

  private async refreshAccessToken() {
    const response = await fetch('https://fb-server-staging.shinez.io/gemini_token?token=XD3DF47234234YYJKODD653EE&account=1774615');
    const jsonToken = await response.json();
    this.accessToken = jsonToken.token;
  }

  private constructor() {
    this.refreshAccessToken()
  }

  private async runRequest(url: string, body?: any, retryCount = 0) {
    if (retryCount > GeminiApi.MAX_RETRIES) return;
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      body: body,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });
    if ([401, 403, 500].includes(response.status)) {
      await this.refreshAccessToken();
      return this.runRequest(url, body, retryCount + 1);
    }
    return response;
  }

  async createCustomReport({ date, adId, advertiserId }: { date: string, adId: number, advertiserId: number }) {
    const payload = {
      "cube": "performance_stats",
      "fields": [
        { "field": "Day" },
        { "field": "Hour" },
        { "field": "Advertiser Timezone" },
        { "field": "Ad ID" },
        { "field": "Clicks" },
        { "field": "Spend" }
      ],
      "filters": [
        {
          "field": "Day",
          "operator": "=",
          "value": date,
        },
        {
          "field": "Advertiser ID",
          "operator": "=",
          "value": advertiserId,
        },
        {
          "field": "Ad ID",
          "operator": "=",
          "value": adId,
        }
      ]
    };
    await this.refreshAccessToken();
    const jobCreationResponse = await this.runRequest(
      `https://${GeminiApi.BASE_URL}/v3/rest/reports/custom?reportFormat=json`,
      JSON.stringify(payload)
    );
    
    console.log('created job', jobCreationResponse.status);
    const jobCreationBody = await jobCreationResponse.json();
    console.log(jobCreationBody);

    if (jobCreationBody?.errors?.length > 0) {
      throw new Error(JSON.stringify(jobCreationBody.errors));
    }

    const jobId = jobCreationBody?.response?.jobId;

    if (!jobId) {
      throw new Error('Could not create reporting task');
    }

    const reportLink = await this.waitForReport(advertiserId, jobId);
    console.log(reportLink);
    return this.fetchReport(reportLink);
  }

  async fetchReport(reportLink) {
    const response = await fetch(reportLink);
    if (response.status !== 200) {
      throw new Error(`Could not retrieve response: ${await response.text()}`);
    }
    return response.json();
  }

  waitForReport(advertiserId: number, jobId: string) {
    return new Promise((resolve) => {
      const pollingTimer = setInterval(async () => {
        const pollingResponse = await this.runRequest(`https://${GeminiApi.BASE_URL}/v3/rest/reports/custom/${jobId}?advertiserId=${advertiserId}`);
        
        if (pollingResponse.status !== 200) {
          throw new Error(`Error while checking the job status: ${await pollingResponse.text()}`);
        }

        const pollingResult = await pollingResponse.json();
        if (pollingResult?.response?.status !== 'completed') {
          console.log('>>> not ready', pollingResult?.response?.status);
          return;
        }
        if (!pollingResult?.response?.jobResponse) {
          throw new Error('Could not read job response link');
        }
        clearInterval(pollingTimer);
        resolve(pollingResult?.response?.jobResponse);
      }, 2000);
    })
  }
}