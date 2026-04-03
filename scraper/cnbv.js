import axios from 'axios';
import { writeFileSync } from 'fs';

// CNBV Datos Abiertos - scrape aggregate consumer credit data
// Source: https://www.cnbv.gob.mx/Paginas/Datos-Abiertos.aspx
// and Portafolio de Información: https://portafolioinfo.cnbv.gob.mx/

const CNBV_API = 'https://portafolioinfo.cnbv.gob.mx/api';

// Fallback: scrape summary data from datos.gob.mx
const DATOS_GOB_SEARCH = 'https://datos.gob.mx/busca/api/3/action/package_search';

async function searchDatosGob(query) {
  console.log(`Searching datos.gob.mx for: "${query}"...`);
  try {
    const res = await axios.get(DATOS_GOB_SEARCH, {
      params: { q: query, rows: 5 },
      timeout: 15000,
    });
    const results = res.data?.result?.results || [];
    return results.map(r => ({
      title: r.title,
      description: r.notes?.substring(0, 200),
      resources: (r.resources || []).map(res => ({
        name: res.name,
        format: res.format,
        url: res.url,
      })),
    }));
  } catch (err) {
    console.warn('datos.gob.mx search failed:', err.message);
    return [];
  }
}

export async function scrapeCNBV() {
  // Search for consumer credit datasets on datos.gob.mx
  const queries = [
    'cartera credito consumo CNBV',
    'morosidad banca multiple',
    'tarjeta credito cartera',
  ];

  const allResults = [];
  for (const q of queries) {
    const results = await searchDatosGob(q);
    allResults.push(...results);
  }

  // Try to download any CSV resources found
  const csvResources = allResults
    .flatMap(r => r.resources)
    .filter(r => r.format?.toLowerCase() === 'csv' && r.url);

  const downloaded = [];
  for (const resource of csvResources.slice(0, 3)) {
    try {
      console.log(`Downloading: ${resource.name}...`);
      const res = await axios.get(resource.url, { timeout: 30000, responseType: 'text' });
      downloaded.push({
        name: resource.name,
        url: resource.url,
        rows: res.data.split('\n').length,
        preview: res.data.split('\n').slice(0, 5),
      });
    } catch (err) {
      console.warn(`Failed to download ${resource.name}: ${err.message}`);
    }
  }

  const output = {
    search_results: allResults,
    downloaded_csvs: downloaded,
    metadata: {
      scraped_at: new Date().toISOString(),
      source: 'datos.gob.mx + CNBV',
    },
  };

  writeFileSync('data/cnbv_search_results.json', JSON.stringify(output, null, 2));
  console.log(`Saved CNBV search results (${allResults.length} datasets found)`);
  return output;
}
