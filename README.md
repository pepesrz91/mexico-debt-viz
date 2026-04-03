# Mexico Consumer Debt Visualization

Interactive D3.js dashboard exploring consumer debt trends in Mexico, built with data from **Banxico** (Banco de Mexico) and **CNBV** (Comision Nacional Bancaria y de Valores).

## What it shows

- **Consumer credit evolution** — total portfolio and delinquent debt over time
- **Debt breakdown** — how Mexicans borrow (credit cards, auto loans, payroll, etc.)
- **Delinquency rates (IMOR)** — percentage of non-performing loans by credit type
- **Debt per capita** — average debt per person and per economically active person
- **Credit cards** — number in circulation and credit utilization
- **Mortgages** — housing credit portfolio and delinquency trends

## Getting started

```bash
npm install
npm run dev   # serve the dashboard locally
```

## Tech stack

- **D3.js** — charts and data visualization
- **Vanilla HTML/CSS/JS** — zero-framework frontend

## Data sources

- [Banxico SIE API](https://www.banxico.org.mx/SieAPIRest/service/v1/) — official monetary and financial statistics
- [CNBV Portafolio de Informacion](https://portafolioinfo.cnbv.gob.mx/) — banking sector regulatory data
- [INEGI](https://www.inegi.org.mx/) — population and economic activity figures

## Want to explore more data?

The [Banxico SIE API](https://www.banxico.org.mx/SieAPIRest/service/v1/) is a free, public API with thousands of time series covering interest rates, exchange rates, inflation, credit aggregates, and more. You can get a free token at [banxico.org.mx](https://www.banxico.org.mx/SieAPIRest/service/v1/token) and query any series — the `scraper/` directory in this repo has examples of how to pull consumer credit data programmatically.

## Author

**Pepe Suarez** — Staff Engineer at [Digitt](https://www.digitt.com), where we're building smarter credit refinancing for Latin America. This project started as independent research into Mexico's consumer debt landscape.

[pepesuarez.dev](https://pepesuarez.dev)

## License

ISC
