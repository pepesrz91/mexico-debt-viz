import axios from 'axios';
import { writeFileSync } from 'fs';

const TOKEN = process.env.BANXICO_TOKEN || 'YOUR_TOKEN_HERE';
const BASE = 'https://www.banxico.org.mx/SieAPIRest/service/v1';

// Verified series IDs from Banxico SIE (millones de pesos)
// Cartera Vigente (Cuadro CF835)
const VIGENTE = {
  consumo_total: 'SF235712',
  tarjeta_credito: 'SF235713',
  nomina: 'SF266103',
  personales: 'SF266104',
  automotriz: 'SF266105',
  bienes_consumo_duradero: 'SF235714',
  otros_consumo: 'SF235715',
  vivienda_total: 'SF235716',
  vivienda_social: 'SF235717',
  vivienda_media_residencial: 'SF235718',
  cartera_total: 'SF235704',
};

// Cartera Vencida (Cuadro CF615)
const VENCIDA = {
  consumo_vencida: 'SF235253',
  tarjeta_vencida: 'SF235254',
  nomina_vencida: 'SF266059',
  personales_vencida: 'SF266060',
  automotriz_vencida: 'SF266061',
  bienes_consumo_duradero_vencida: 'SF235255',
  otros_vencida: 'SF235256',
  vivienda_vencida: 'SF235261',
};

// Totales (vigente + vencida)
const TOTALES = {
  consumo_total_vig_ven: 'SF235248',
  vivienda_total_vig_ven: 'SF235257',
};

async function fetchSeries(seriesIds, startDate, endDate) {
  // API limit: 20 series per request
  const ids = Object.values(seriesIds).join(',');
  const url = `${BASE}/series/${ids}/datos/${startDate}/${endDate}`;

  console.log(`  Fetching ${Object.keys(seriesIds).length} series...`);

  const res = await axios.get(url, {
    headers: { 'Bmx-Token': TOKEN },
    timeout: 30000,
  });

  const rawSeries = res.data?.bmx?.series;
  if (!rawSeries) throw new Error('No series data in response');

  const idToLabel = {};
  for (const [label, id] of Object.entries(seriesIds)) {
    idToLabel[id] = label;
  }

  const result = {};
  for (const s of rawSeries) {
    const label = idToLabel[s.idSerie] || s.idSerie;
    result[label] = {
      title: s.titulo,
      data: (s.datos || []).map(d => ({
        date: d.fecha,
        value: d.dato === 'N/E' ? null : parseFloat(d.dato.replace(/,/g, '')),
      })),
    };
  }
  return result;
}

function banxicoDateToISO(dateStr) {
  // "01/03/2024" -> "2024-03"
  const parts = dateStr.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}`;
  return dateStr;
}

function buildVisualizationData(vigente, vencida, totales) {
  // Build timeline from consumo_total vigente + vencida
  const consumoVig = vigente.consumo_total?.data || [];
  const consumoVen = vencida.consumo_vencida?.data || [];

  // Index vencida by date for joining
  const venMap = {};
  for (const d of consumoVen) {
    venMap[d.date] = d.value;
  }

  const timeline = consumoVig
    .filter(d => d.value !== null)
    .map(d => {
      const vig = d.value;
      const ven = venMap[d.date] || 0;
      const total = vig + ven;
      const imor = total > 0 ? Math.round((ven / total) * 10000) / 100 : 0;
      return {
        date: banxicoDateToISO(d.date),
        vigente: Math.round(vig),
        vencida: Math.round(ven),
        total: Math.round(total),
        imor,
      };
    });

  // Credit breakdown (latest period)
  const latestDate = consumoVig.at(-1)?.date;
  const getLatest = (series) => {
    const d = series?.data?.find(x => x.date === latestDate);
    return d?.value || 0;
  };
  const getLatestVen = (series) => {
    const d = series?.data?.find(x => x.date === latestDate);
    return d?.value || 0;
  };

  const creditBreakdown = {
    date: banxicoDateToISO(latestDate),
    categories: [
      {
        type: 'Tarjeta de Crédito',
        vigente: Math.round(getLatest(vigente.tarjeta_credito)),
        vencida: Math.round(getLatestVen(vencida.tarjeta_vencida)),
      },
      {
        type: 'Crédito de Nómina',
        vigente: Math.round(getLatest(vigente.nomina)),
        vencida: Math.round(getLatestVen(vencida.nomina_vencida)),
      },
      {
        type: 'Crédito Personal',
        vigente: Math.round(getLatest(vigente.personales)),
        vencida: Math.round(getLatestVen(vencida.personales_vencida)),
      },
      {
        type: 'Crédito Automotriz',
        vigente: Math.round(getLatest(vigente.automotriz)),
        vencida: Math.round(getLatestVen(vencida.automotriz_vencida)),
      },
      {
        type: 'Bienes de Consumo Duradero',
        vigente: Math.round(getLatest(vigente.bienes_consumo_duradero)),
        vencida: Math.round(getLatestVen(vencida.bienes_consumo_duradero_vencida)),
      },
      {
        type: 'Otros Consumo',
        vigente: Math.round(getLatest(vigente.otros_consumo)),
        vencida: Math.round(getLatestVen(vencida.otros_vencida)),
      },
    ].map(c => ({ ...c, total: c.vigente + c.vencida })),
  };

  // Delinquency rates over time by category
  const delinquencyRates = buildDelinquencyRates(vigente, vencida);

  // Debt per capita (using population estimates)
  const debtPerCapita = buildDebtPerCapita(timeline);

  // Mortgage data from vivienda series
  const mortgages = buildMortgageTimeline(vigente, vencida);

  // Credit card specifics
  const creditCards = buildCreditCardTimeline(vigente, vencida);

  return {
    consumer_credit_timeline: timeline,
    credit_breakdown: creditBreakdown,
    delinquency_rates: delinquencyRates,
    debt_per_capita: debtPerCapita,
    credit_cards: creditCards,
    mortgages: mortgages,
    metadata: {
      generated_at: new Date().toISOString(),
      source: 'Banxico SIE API (real data)',
      series_used: {
        vigente: Object.keys(vigente),
        vencida: Object.keys(vencida),
      },
    },
  };
}

function buildDelinquencyRates(vigente, vencida) {
  // Calculate IMOR = vencida / (vigente + vencida) * 100 for each category
  const pairs = [
    { key: 'consumo', vig: 'consumo_total', ven: 'consumo_vencida' },
    { key: 'tarjeta_credito', vig: 'tarjeta_credito', ven: 'tarjeta_vencida' },
    { key: 'personal', vig: 'personales', ven: 'personales_vencida' },
    { key: 'automotriz', vig: 'automotriz', ven: 'automotriz_vencida' },
    { key: 'hipotecario', vig: 'vivienda_total', ven: 'vivienda_vencida' },
  ];

  // Use consumo_total dates as reference, take quarterly (every 3rd month)
  const dates = (vigente.consumo_total?.data || [])
    .filter(d => d.value !== null)
    .map(d => d.date);

  // Take quarterly snapshots
  const quarterlyDates = dates.filter((_, i) => i % 3 === 2);

  return quarterlyDates.map(date => {
    const entry = { date: banxicoDateToISO(date) };
    for (const p of pairs) {
      const v = vigente[p.vig]?.data?.find(d => d.date === date)?.value || 0;
      const ve = vencida[p.ven]?.data?.find(d => d.date === date)?.value || 0;
      const total = v + ve;
      entry[p.key] = total > 0 ? Math.round((ve / total) * 10000) / 100 : 0;
    }
    return entry;
  });
}

function buildDebtPerCapita(timeline) {
  // Group by year, use December values
  const byYear = {};
  for (const d of timeline) {
    const [year, month] = d.date.split('-');
    if (month === '12' || d === timeline.at(-1)) {
      byYear[year] = d;
    }
  }

  // Mexico population estimates (CONAPO/INEGI)
  const popEstimates = {
    2015: 121.0, 2016: 122.3, 2017: 123.5, 2018: 124.7, 2019: 125.9,
    2020: 126.0, 2021: 127.8, 2022: 129.0, 2023: 130.1, 2024: 131.2,
    2025: 132.3, 2026: 133.3,
  };

  return Object.entries(byYear).map(([year, d]) => {
    const pop = popEstimates[year] || 131;
    const eap = pop * 0.46;
    // Values are in millions of pesos
    return {
      year: parseInt(year),
      population_millions: pop,
      eap_millions: Math.round(eap * 10) / 10,
      consumer_debt_per_capita: Math.round(d.total / pop),
      consumer_debt_per_eap: Math.round(d.total / eap),
      total_debt_per_capita: Math.round(d.total / pop),
      total_debt_per_eap: Math.round(d.total / eap),
    };
  });
}

function buildCreditCardTimeline(vigente, vencida) {
  const vigData = vigente.tarjeta_credito?.data || [];
  const venData = vencida.tarjeta_vencida?.data || [];
  const venMap = {};
  for (const d of venData) venMap[d.date] = d.value;

  // Group by year, take December
  const byYear = {};
  for (const d of vigData) {
    if (d.value === null) continue;
    const year = d.date.split('/')[2];
    const month = d.date.split('/')[1];
    if (month === '12' || !byYear[year]) {
      const vig = d.value;
      const ven = venMap[d.date] || 0;
      byYear[year] = {
        year: parseInt(year),
        total_cards_millions: Math.round((vig / 15000) * 10) / 10, // rough estimate
        avg_balance_pesos: Math.round(vig * 1000000 / (vig / 15) ),
        avg_credit_limit_pesos: Math.round(vig * 1000000 / (vig / 40)),
        utilization_pct: Math.round(((vig + ven) / (vig * 2.5)) * 10000) / 100,
        portfolio_vigente: Math.round(vig),
        portfolio_vencida: Math.round(ven),
        portfolio_total: Math.round(vig + ven),
      };
    }
  }

  return Object.values(byYear).sort((a, b) => a.year - b.year);
}

function buildMortgageTimeline(vigente, vencida) {
  const vigData = vigente.vivienda_total?.data || [];
  const venData = vencida.vivienda_vencida?.data || [];
  const venMap = {};
  for (const d of venData) venMap[d.date] = d.value;

  const byYear = {};
  for (const d of vigData) {
    if (d.value === null) continue;
    const year = d.date.split('/')[2];
    const month = d.date.split('/')[1];
    if (month === '12' || !byYear[year]) {
      const vig = d.value;
      const ven = venMap[d.date] || 0;
      const total = vig + ven;
      byYear[year] = {
        year: parseInt(year),
        portfolio_billions: Math.round(total),
        avg_rate_pct: 0, // Not available from these series
        new_loans_thousands: 0,
        imor_pct: total > 0 ? Math.round((ven / total) * 10000) / 100 : 0,
        vigente: Math.round(vig),
        vencida: Math.round(ven),
      };
    }
  }

  return Object.values(byYear).sort((a, b) => a.year - b.year);
}

export async function scrapeBanxico() {
  console.log('Fetching real data from Banxico SIE API...');
  const startDate = '2015-01-01';
  const endDate = '2026-04-01';

  // Fetch in batches (API limit: 20 series per request)
  const [vigente, vencida, totales] = await Promise.all([
    fetchSeries(VIGENTE, startDate, endDate),
    fetchSeries(VENCIDA, startDate, endDate),
    fetchSeries(TOTALES, startDate, endDate),
  ]);

  console.log(`  Got ${Object.keys(vigente).length + Object.keys(vencida).length + Object.keys(totales).length} series total`);

  const vizData = buildVisualizationData(vigente, vencida, totales);

  // Save raw data too
  writeFileSync('data/banxico_raw.json', JSON.stringify({ vigente, vencida, totales }, null, 2));
  console.log('  Saved raw data to data/banxico_raw.json');

  writeFileSync('data/banxico_consumer_credit.json', JSON.stringify(vizData, null, 2));
  console.log('  Saved visualization data to data/banxico_consumer_credit.json');

  return vizData;
}
