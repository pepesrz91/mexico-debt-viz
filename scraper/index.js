import { scrapeBanxico } from './banxico.js';
import { scrapeCNBV } from './cnbv.js';
import { generateSampleData } from './sample-data.js';
import { existsSync } from 'fs';

async function main() {
  console.log('=== Mexico Debt Data Scraper ===\n');

  const hasBanxicoToken =
    process.env.BANXICO_TOKEN && process.env.BANXICO_TOKEN !== 'YOUR_TOKEN_HERE';

  if (hasBanxicoToken) {
    try {
      await scrapeBanxico();
    } catch (err) {
      console.error('Banxico scrape failed:', err.message);
      console.log('Falling back to sample data...');
      generateSampleData();
    }
  } else {
    console.log('No BANXICO_TOKEN set. Using sample data for visualization.');
    console.log('To use real data, get a free token at:');
    console.log('https://www.banxico.org.mx/SieAPIRest/service/v1/token\n');
    generateSampleData();
  }

  try {
    await scrapeCNBV();
  } catch (err) {
    console.error('CNBV scrape failed:', err.message);
  }

  console.log('\nDone! Run `npm run dev` to view visualizations.');
}

main();
