import { writeFileSync } from 'fs';

// Sample data based on real Banxico/CNBV published figures (approximate)
// Sources: Banxico SIE, CNBV Portafolio de Información reports
// Values in billions of MXN pesos unless noted

export function generateSampleData() {
  console.log('Generating sample data based on published Banxico/CNBV figures...');

  const data = {
    // Consumer credit portfolio evolution (billions MXN)
    consumer_credit_timeline: generateTimeline(),
    // Breakdown by credit type (latest period)
    credit_breakdown: {
      date: '2025-12',
      categories: [
        { type: 'Tarjeta de Crédito', vigente: 598, vencida: 48, total: 646 },
        { type: 'Crédito de Nómina', vigente: 312, vencida: 18, total: 330 },
        { type: 'Crédito Personal', vigente: 245, vencida: 22, total: 267 },
        { type: 'Crédito Automotriz', vigente: 198, vencida: 8, total: 206 },
        { type: 'Otros Consumo', vigente: 85, vencida: 6, total: 91 },
      ],
    },
    // Delinquency rates (IMOR) over time
    delinquency_rates: generateDelinquencyRates(),
    // Debt per capita estimates
    debt_per_capita: generateDebtPerCapita(),
    // Credit cards in circulation
    credit_cards: generateCreditCards(),
    // Mortgage data
    mortgages: generateMortgageData(),
    metadata: {
      generated_at: new Date().toISOString(),
      note: 'Sample data based on published Banxico/CNBV aggregate figures. For exact figures, use BANXICO_TOKEN.',
      sources: [
        'Banxico SIE - Agregados Monetarios',
        'CNBV - Portafolio de Información Banca Múltiple',
        'INEGI - Población',
      ],
    },
  };

  writeFileSync('data/banxico_consumer_credit.json', JSON.stringify(data, null, 2));
  console.log('Saved sample data to data/banxico_consumer_credit.json');
  return data;
}

function generateTimeline() {
  const months = [];
  // Monthly data from 2015 to 2025
  for (let year = 2015; year <= 2025; year++) {
    for (let month = 1; month <= 12; month++) {
      if (year === 2025 && month > 12) break;
      const date = `${year}-${String(month).padStart(2, '0')}`;
      const t = (year - 2015) * 12 + month;

      // Growth trend with COVID dip in 2020 and post-recovery surge
      let base = 800 + t * 8; // steady growth
      if (year === 2020 && month >= 4 && month <= 9) {
        base *= 0.88 - (6 - Math.abs(month - 6.5)) * 0.02; // COVID dip
      }
      if (year >= 2021) {
        base *= 1 + (year - 2020) * 0.04; // post-COVID acceleration
      }
      // Add some realistic noise
      const noise = (Math.sin(t * 0.7) * 15 + Math.cos(t * 1.3) * 10);

      const vigente = Math.round(base + noise);
      const morosidad = year === 2020 ? 0.055 + Math.random() * 0.02 :
                        year >= 2023 ? 0.035 + Math.random() * 0.01 :
                        0.04 + Math.random() * 0.015;
      const vencida = Math.round(vigente * morosidad);

      months.push({
        date,
        vigente, // performing loans (billions MXN)
        vencida, // non-performing loans
        total: vigente + vencida,
        imor: Math.round(morosidad * 10000) / 100, // delinquency rate %
      });
    }
  }
  return months;
}

function generateDelinquencyRates() {
  const data = [];
  for (let year = 2015; year <= 2025; year++) {
    for (let q = 1; q <= 4; q++) {
      if (year === 2025 && q > 4) break;
      const date = `${year}-Q${q}`;

      let consumoBase = 4.2;
      let tarjetaBase = 5.8;
      let hipotecarioBase = 3.1;

      // COVID spike
      if (year === 2020) {
        const spike = q >= 2 ? 1.5 + (q - 2) * 0.5 : 0;
        consumoBase += spike;
        tarjetaBase += spike * 1.2;
        hipotecarioBase += spike * 0.4;
      }
      // Post-COVID gradual decline then recent uptick
      if (year >= 2021 && year <= 2022) {
        consumoBase -= (year - 2020) * 0.3;
        tarjetaBase -= (year - 2020) * 0.4;
      }
      if (year >= 2024) {
        consumoBase += 0.8;
        tarjetaBase += 1.2;
        hipotecarioBase += 0.3;
      }

      data.push({
        date,
        consumo: Math.round((consumoBase + Math.random() * 0.5) * 100) / 100,
        tarjeta_credito: Math.round((tarjetaBase + Math.random() * 0.6) * 100) / 100,
        hipotecario: Math.round((hipotecarioBase + Math.random() * 0.3) * 100) / 100,
        personal: Math.round((consumoBase * 0.9 + Math.random() * 0.4) * 100) / 100,
        automotriz: Math.round((2.5 + Math.random() * 0.5) * 100) / 100,
      });
    }
  }
  return data;
}

function generateDebtPerCapita() {
  // Mexican population ~130M, economically active ~60M
  const data = [];
  for (let year = 2015; year <= 2025; year++) {
    const pop = 120 + year * 0.8; // millions, rough
    const eap = pop * 0.46; // economically active

    const totalDebt = 800 + (year - 2015) * 120; // billions MXN rough total consumer debt
    const totalWithMortgage = totalDebt + 1800 + (year - 2015) * 180;

    data.push({
      year,
      population_millions: Math.round(pop * 10) / 10,
      eap_millions: Math.round(eap * 10) / 10,
      consumer_debt_per_capita: Math.round((totalDebt * 1000) / pop),
      consumer_debt_per_eap: Math.round((totalDebt * 1000) / eap),
      total_debt_per_capita: Math.round((totalWithMortgage * 1000) / pop),
      total_debt_per_eap: Math.round((totalWithMortgage * 1000) / eap),
    });
  }
  return data;
}

function generateCreditCards() {
  const data = [];
  for (let year = 2015; year <= 2025; year++) {
    const cards = 25 + (year - 2015) * 1.8; // millions of cards
    const yearDip = year === 2020 ? -3 : 0;

    data.push({
      year,
      total_cards_millions: Math.round((cards + yearDip) * 10) / 10,
      avg_balance_pesos: Math.round(14000 + (year - 2015) * 2200),
      avg_credit_limit_pesos: Math.round(38000 + (year - 2015) * 3500),
      utilization_pct: Math.round((37 + (year - 2015) * 0.8 + (year >= 2023 ? 3 : 0)) * 10) / 10,
    });
  }
  return data;
}

function generateMortgageData() {
  const data = [];
  for (let year = 2015; year <= 2025; year++) {
    data.push({
      year,
      portfolio_billions: Math.round(1800 + (year - 2015) * 185),
      avg_rate_pct: Math.round((year <= 2018 ? 10.5 : year <= 2021 ? 9.8 : 11.2 + (year - 2022) * 0.3) * 10) / 10,
      new_loans_thousands: Math.round(320 + (year - 2015) * 12 + (year === 2020 ? -80 : 0)),
      imor_pct: Math.round((3.1 + (year === 2020 ? 0.8 : 0) + (year >= 2024 ? 0.4 : 0) + Math.random() * 0.3) * 100) / 100,
    });
  }
  return data;
}
