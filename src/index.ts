import express from 'express';
import getReport from './reports';
const app = express();

app.get('/insights', async (req, res) => {
  const { hour, date, ad_id: adId, nocache } = req.query as any;
  try {
    const report = await getReport(hour, date, adId, nocache);
    res.json(report);
  } catch (e) {
    res.json({
      success: false,
      error: e.toString(),
    });
  }
});

app.listen(3000, () => { });