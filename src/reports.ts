import GeminiApi from "./gemini";

const ADVETISER_ID_HARDCODE = process.env.ADVERTISER_ID ? parseInt(process.env.ADVERTISER_ID) : 1774615;

const cache: Record<string, any> = {};


const filterReportForHour = (report, hour) => (report.rows.filter(row => row[1] === hour));
const aggreateClicks = (report) => report.reduce((acc, val) => acc + val[4], 0);
const aggreateSpent = (report) => report.reduce((acc, val) => acc + val[5], 0);


const api = GeminiApi.getInstance();


export default async function getReport(hour, date, adId, nocache) {
  const cacheKey = `${ADVETISER_ID_HARDCODE}/${adId}/${date}/${hour}`;
  if (cache[cacheKey] && !nocache) {
    return {
      success: true,
      cachedAt: cache[cacheKey].cachedAt,
      report: cache[cacheKey].report
    };
  }

  const report = await api.createCustomReport({ date, adId, advertiserId: ADVETISER_ID_HARDCODE });
  const hourlyReport = filterReportForHour(report, parseInt(hour));
  const clicks = aggreateClicks(hourlyReport);
  const spent = aggreateSpent(hourlyReport);

  const result = {
    name: adId,
    date,
    hour,
    clicks,
    spent,
  };
  
  cache[cacheKey] = {
    report: result,
    cachedAt: new Date(),
  };

  return {
    success: true,
    report: result, 
  };
}