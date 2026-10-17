// ==============================================================================
// DEMINVEST — UNIVERSAL INSTRUMENT REGISTRY & BROKER INSTRUMENT MAPPING
// ==============================================================================
// Regole Non Negoziabili (Sezioni 7 e 8):
// 1. Il ticker da solo NON è mai usato come identificativo globale univoco.
// 2. Distinzione rigorosa tra: Sottostante Economico, Strumento Negoziabile,
//    Mercato di quotazione (MIC), Piattaforma/Broker, Simbolo esposto e Provider.
// 3. Un asset Spot/Cash e un CFD sullo stesso sottostante sono strumenti DISTINTI
//    con rischi, costi overnight e struttura legale differenti.
// 4. Stati di verifica espliciti: VERIFIED, USER_CONFIRMED, UNVERIFIED.
// ==============================================================================

import {
  AssetClass,
  BrokerInstrumentMapping,
  BrokerVerificationStatus,
  ContractType,
  NegotiableInstrument,
  PlatformType,
  TradingVenue,
  UnderlyingAsset,
} from '../types/domain';

export const TRADING_VENUES: Record<string, TradingVenue> = {
  CRYPTO_GLOBAL: {
    micCode: 'CRYPTO_GLOBAL',
    name: 'Mercato Globale Spot Crypto (24/7)',
    countryCode: 'GLOBAL',
    timezone: 'UTC',
    currency: 'USD',
    openTime: '00:00',
    closeTime: '23:59',
    is24x7: true,
  },
  XNGS: {
    micCode: 'XNGS',
    name: 'NASDAQ Global Select Market',
    countryCode: 'US',
    timezone: 'America/New_York',
    currency: 'USD',
    openTime: '09:30',
    closeTime: '16:00',
    is24x7: false,
  },
  XNYS: {
    micCode: 'XNYS',
    name: 'New York Stock Exchange (NYSE)',
    countryCode: 'US',
    timezone: 'America/New_York',
    currency: 'USD',
    openTime: '09:30',
    closeTime: '16:00',
    is24x7: false,
  },
  XETR: {
    micCode: 'XETR',
    name: 'Deutsche Börse Xetra (Francoforte)',
    countryCode: 'DE',
    timezone: 'Europe/Berlin',
    currency: 'EUR',
    openTime: '09:00',
    closeTime: '17:30',
    is24x7: false,
  },
  MTAA: {
    micCode: 'MTAA',
    name: 'Euronext Milan (Borsa Italiana)',
    countryCode: 'IT',
    timezone: 'Europe/Rome',
    currency: 'EUR',
    openTime: '09:00',
    closeTime: '17:30',
    is24x7: false,
  },
  FX_INTERBANK: {
    micCode: 'FX_INTERBANK',
    name: 'Mercato Interbancario Forex (24/5)',
    countryCode: 'GLOBAL',
    timezone: 'UTC',
    currency: 'USD',
    openTime: '00:00',
    closeTime: '23:59',
    is24x7: false,
  },
  OTC_CFD: {
    micCode: 'OTC_CFD',
    name: 'Over-The-Counter Dealing Desk CFD',
    countryCode: 'EU',
    timezone: 'Europe/Rome',
    currency: 'EUR',
    openTime: '00:05',
    closeTime: '23:55',
    is24x7: false,
  },
};

export const INITIAL_UNDERLYING_ASSETS: UnderlyingAsset[] = [
  {
    id: 'ASSET_BTC',
    canonicalSymbol: 'BTC',
    name: 'Bitcoin',
    assetClass: 'CRYPTO',
    coingeckoId: 'bitcoin',
    blockchain: 'Bitcoin',
    network: 'Bitcoin Mainnet',
    decimals: 8,
    baseCurrency: 'USD',
    sector: 'Layer-1 Store of Value',
    description: 'Criptovaluta decentralizzata nativa della rete Bitcoin (Proof-of-Work).',
  },
  {
    id: 'ASSET_ETH',
    canonicalSymbol: 'ETH',
    name: 'Ethereum',
    assetClass: 'CRYPTO',
    coingeckoId: 'ethereum',
    blockchain: 'Ethereum',
    network: 'Ethereum Mainnet (EVM)',
    decimals: 18,
    baseCurrency: 'USD',
    sector: 'Smart Contract Platform',
    description: 'Piattaforma decentralizzata per smart contract ed ecosistema DeFi (Proof-of-Stake).',
  },
  {
    id: 'ASSET_SOL',
    canonicalSymbol: 'SOL',
    name: 'Solana',
    assetClass: 'CRYPTO',
    coingeckoId: 'solana',
    blockchain: 'Solana',
    network: 'Solana Mainnet-Beta',
    decimals: 9,
    baseCurrency: 'USD',
    sector: 'High-Throughput Layer-1',
    description: 'Infrastruttura blockchain ad alte prestazioni basata su Proof-of-History e Proof-of-Stake.',
  },
  {
    id: 'ASSET_LINK',
    canonicalSymbol: 'LINK',
    name: 'Chainlink',
    assetClass: 'CRYPTO',
    coingeckoId: 'chainlink',
    blockchain: 'Ethereum',
    network: 'ERC-20',
    contractAddress: '0x514910771af9ca656af840dff83e8264ecf986ca',
    decimals: 18,
    baseCurrency: 'USD',
    sector: 'Decentralized Oracles',
    description: 'Rete decentralizzata di oracoli per la connessione tra smart contract e dati reali.',
  },
  {
    id: 'ASSET_AAPL',
    canonicalSymbol: 'AAPL',
    name: 'Apple Inc.',
    assetClass: 'EQUITY',
    isin: 'US0378331005',
    issuerName: 'Apple Inc.',
    baseCurrency: 'USD',
    sector: 'Information Technology',
    country: 'US',
    description: 'Società tecnologica statunitense quotata al NASDAQ Global Select Market (MIC: XNGS).',
  },
  {
    id: 'ASSET_IBM',
    canonicalSymbol: 'IBM',
    name: 'International Business Machines Corp.',
    assetClass: 'EQUITY',
    isin: 'US4592001014',
    issuerName: 'IBM Corporation',
    baseCurrency: 'USD',
    sector: 'Enterprise Technology & AI',
    country: 'US',
    description: 'Multinazionale statunitense di hardware, cloud ibrido e intelligenza artificiale quotata al NYSE (MIC: XNYS).',
  },
  {
    id: 'ASSET_VWCE',
    canonicalSymbol: 'VWCE',
    name: 'Vanguard FTSE All-World UCITS ETF (USD) Accumulating',
    assetClass: 'ETF',
    isin: 'IE00BK5BQT80',
    issuerName: 'Vanguard Group (Ireland) Limited',
    baseCurrency: 'EUR',
    sector: 'Global Equity All-Cap',
    country: 'IE',
    description: 'ETF armonizzato UCITS ad accumulazione che replica l\'indice FTSE All-World (paesi sviluppati ed emergenti).',
  },
  {
    id: 'ASSET_EURUSD',
    canonicalSymbol: 'EUR/USD',
    name: 'Cambio Euro / Dollaro Statunitense',
    assetClass: 'FOREX',
    baseCurrency: 'USD',
    sector: 'G10 Major Forex',
    description: 'Tasso di cambio spot tra la valuta unica europea (EUR) e il dollaro statunitense (USD).',
  },
  {
    id: 'ASSET_SP500',
    canonicalSymbol: 'SPX',
    name: 'S&P 500 Index',
    assetClass: 'INDEX',
    issuerName: 'S&P Dow Jones Indices',
    baseCurrency: 'USD',
    sector: 'US Large-Cap Benchmark',
    country: 'US',
    description: 'Indice azionario delle 500 maggiori società statunitensi per capitalizzazione.',
  },
  {
    id: 'ASSET_BTP10Y',
    canonicalSymbol: 'BTP-10Y',
    name: 'BTP Italia Benchmark 10 Anni',
    assetClass: 'BOND',
    isin: 'IT0005560948',
    issuerName: 'Ministero dell\'Economia e delle Finanze (Repubblica Italiana)',
    baseCurrency: 'EUR',
    sector: 'Sovereign Fixed Income',
    country: 'IT',
    description: 'Titolo di Stato italiano a tasso fisso negoziato sul MOT (Borsa Italiana).',
  },
  {
    id: 'ASSET_XAUUSD',
    canonicalSymbol: 'XAU/USD',
    name: 'Oro Spot (Gold Troy Ounce)',
    assetClass: 'COMMODITY',
    baseCurrency: 'USD',
    sector: 'Precious Metals',
    description: 'Prezzo di riferimento di un\'oncia troy d\'oro fino espressa in dollari statunitensi.',
  },
];

export const INITIAL_NEGOTIABLE_INSTRUMENTS: NegotiableInstrument[] = [
  {
    id: 'INST_BTC_USD_SPOT',
    underlyingAssetId: 'ASSET_BTC',
    instrumentType: 'SPOT_CRYPTO',
    ticker: 'BTC/USD',
    name: 'Bitcoin Spot (USD)',
    assetClass: 'CRYPTO',
    venueMic: 'CRYPTO_GLOBAL',
    venueName: 'Mercato Globale Spot Crypto',
    quoteCurrency: 'USD',
    baseAssetSymbol: 'BTC',
    quoteAssetSymbol: 'USD',
    coingeckoId: 'bitcoin',
    isDerivative: false,
    primaryProviderId: 'coingecko',
    providerSymbol: 'bitcoin',
    secondaryProviderId: 'twelvedata',
    secondaryProviderSymbol: 'BTC/USD',
    liquidityTier: 'HIGH',
  },
  {
    id: 'INST_ETH_USD_SPOT',
    underlyingAssetId: 'ASSET_ETH',
    instrumentType: 'SPOT_CRYPTO',
    ticker: 'ETH/USD',
    name: 'Ethereum Spot (USD)',
    assetClass: 'CRYPTO',
    venueMic: 'CRYPTO_GLOBAL',
    venueName: 'Mercato Globale Spot Crypto',
    quoteCurrency: 'USD',
    baseAssetSymbol: 'ETH',
    quoteAssetSymbol: 'USD',
    coingeckoId: 'ethereum',
    isDerivative: false,
    primaryProviderId: 'coingecko',
    providerSymbol: 'ethereum',
    liquidityTier: 'HIGH',
  },
  {
    id: 'INST_SOL_USD_SPOT',
    underlyingAssetId: 'ASSET_SOL',
    instrumentType: 'SPOT_CRYPTO',
    ticker: 'SOL/USD',
    name: 'Solana Spot (USD)',
    assetClass: 'CRYPTO',
    venueMic: 'CRYPTO_GLOBAL',
    venueName: 'Mercato Globale Spot Crypto',
    quoteCurrency: 'USD',
    baseAssetSymbol: 'SOL',
    quoteAssetSymbol: 'USD',
    coingeckoId: 'solana',
    isDerivative: false,
    primaryProviderId: 'coingecko',
    providerSymbol: 'solana',
    liquidityTier: 'HIGH',
  },
  {
    id: 'INST_LINK_USD_SPOT',
    underlyingAssetId: 'ASSET_LINK',
    instrumentType: 'SPOT_CRYPTO',
    ticker: 'LINK/USD',
    name: 'Chainlink Spot (USD - ERC20)',
    assetClass: 'CRYPTO',
    venueMic: 'CRYPTO_GLOBAL',
    venueName: 'Mercato Globale Spot Crypto',
    quoteCurrency: 'USD',
    baseAssetSymbol: 'LINK',
    quoteAssetSymbol: 'USD',
    coingeckoId: 'chainlink',
    isDerivative: false,
    primaryProviderId: 'coingecko',
    providerSymbol: 'chainlink',
    liquidityTier: 'HIGH',
  },
  {
    id: 'INST_AAPL_XNGS_EQ',
    underlyingAssetId: 'ASSET_AAPL',
    instrumentType: 'CASH_EQUITY',
    ticker: 'AAPL',
    name: 'Apple Inc. (Azioni Ordinarie Cash)',
    assetClass: 'EQUITY',
    venueMic: 'XNGS',
    venueName: 'NASDAQ Global Select Market',
    quoteCurrency: 'USD',
    isin: 'US0378331005',
    isDerivative: false,
    primaryProviderId: 'twelvedata',
    providerSymbol: 'AAPL',
    secondaryProviderId: 'alphavantage',
    secondaryProviderSymbol: 'AAPL',
    liquidityTier: 'HIGH',
  },
  {
    id: 'INST_IBM_XNYS_EQ',
    underlyingAssetId: 'ASSET_IBM',
    instrumentType: 'CASH_EQUITY',
    ticker: 'IBM',
    name: 'IBM Corp. (Azioni Ordinarie Cash)',
    assetClass: 'EQUITY',
    venueMic: 'XNYS',
    venueName: 'New York Stock Exchange (NYSE)',
    quoteCurrency: 'USD',
    isin: 'US4592001014',
    isDerivative: false,
    primaryProviderId: 'alphavantage',
    providerSymbol: 'IBM',
    secondaryProviderId: 'twelvedata',
    secondaryProviderSymbol: 'IBM',
    liquidityTier: 'HIGH',
  },
  {
    id: 'INST_VWCE_XETR_ETF',
    underlyingAssetId: 'ASSET_VWCE',
    instrumentType: 'UCITS_ETF',
    ticker: 'VWCE.DE',
    name: 'Vanguard FTSE All-World UCITS ETF (Acc)',
    assetClass: 'ETF',
    venueMic: 'XETR',
    venueName: 'Deutsche Börse Xetra',
    quoteCurrency: 'EUR',
    isin: 'IE00BK5BQT80',
    isDerivative: false,
    primaryProviderId: 'twelvedata',
    providerSymbol: 'VWCE:XETR',
    liquidityTier: 'HIGH',
  },
  {
    id: 'INST_EURUSD_FX',
    underlyingAssetId: 'ASSET_EURUSD',
    instrumentType: 'SPOT_FOREX',
    ticker: 'EUR/USD',
    name: 'Euro / US Dollar Spot',
    assetClass: 'FOREX',
    venueMic: 'FX_INTERBANK',
    venueName: 'Mercato Interbancario Forex',
    quoteCurrency: 'USD',
    baseAssetSymbol: 'EUR',
    quoteAssetSymbol: 'USD',
    isDerivative: false,
    primaryProviderId: 'twelvedata',
    providerSymbol: 'EUR/USD',
    liquidityTier: 'HIGH',
  },
  {
    id: 'INST_BTC_CFD_DERIV',
    underlyingAssetId: 'ASSET_BTC',
    instrumentType: 'CFD',
    ticker: 'BTCUSD.CFD',
    name: 'Contratto per Differenza (CFD) su Bitcoin',
    assetClass: 'DERIVATIVE',
    venueMic: 'OTC_CFD',
    venueName: 'OTC Dealing Desk CFD',
    quoteCurrency: 'USD',
    baseAssetSymbol: 'BTC',
    quoteAssetSymbol: 'USD',
    isDerivative: true,
    primaryProviderId: 'coingecko',
    providerSymbol: 'bitcoin',
    liquidityTier: 'MEDIUM',
  },
  {
    id: 'INST_BTP10Y_MTAA_BOND',
    underlyingAssetId: 'ASSET_BTP10Y',
    instrumentType: 'BOND_GOVT',
    ticker: 'BTP-10Y.MI',
    name: 'BTP Italia Benchmark 10Y (MOT)',
    assetClass: 'BOND',
    venueMic: 'MTAA',
    venueName: 'Euronext Milan (MOT)',
    quoteCurrency: 'EUR',
    isin: 'IT0005560948',
    isDerivative: false,
    primaryProviderId: 'twelvedata',
    providerSymbol: 'BTP10Y',
    liquidityTier: 'HIGH',
  },
  {
    id: 'INST_XAUUSD_SPOT',
    underlyingAssetId: 'ASSET_XAUUSD',
    instrumentType: 'COMMODITY_SPOT',
    ticker: 'XAU/USD',
    name: 'Oro Spot (Gold / USD)',
    assetClass: 'COMMODITY',
    venueMic: 'FX_INTERBANK',
    venueName: 'London Bullion / OTC Spot',
    quoteCurrency: 'USD',
    isDerivative: false,
    primaryProviderId: 'twelvedata',
    providerSymbol: 'XAU/USD',
    liquidityTier: 'HIGH',
  },
];

export const INITIAL_BROKER_MAPPINGS: BrokerInstrumentMapping[] = [
  // --- TRADE REPUBLIC ---
  {
    id: 'MAP_TR_AAPL',
    instrumentId: 'INST_AAPL_XNGS_EQ',
    underlyingAssetId: 'ASSET_AAPL',
    brokerCode: 'TRADE_REPUBLIC',
    brokerName: 'Trade Republic Bank GmbH',
    platformType: 'BROKER',
    brokerSymbol: 'US0378331005 (APC)',
    brokerInstrumentName: 'Apple Inc. (Azioni su Lang & Schwarz Exchange)',
    contractType: 'CASH_SHARE',
    currency: 'EUR',
    venueLabel: 'Lang & Schwarz Exchange (LS Exchange)',
    verificationStatus: 'VERIFIED',
    verificationSource: 'ISIN ufficiale US0378331005 verificato nel registro strumenti',
    commissionNotes: '1,00 EUR di costo fisso di regolamento per singolo ordine (0 EUR per piani PAC idonei), più spread di mercato LS Exchange.',
    tradingConditionsNotes: 'Negoziazione in EUR su LS Exchange (07:30–23:00 CET). Attenzione a possibile ampliamento dello spread fuori dagli orari di apertura di Wall Street (15:30–22:00 CET).',
    lastVerifiedAt: '2026-10-15T10:00:00Z',
  },
  {
    id: 'MAP_TR_VWCE',
    instrumentId: 'INST_VWCE_XETR_ETF',
    underlyingAssetId: 'ASSET_VWCE',
    brokerCode: 'TRADE_REPUBLIC',
    brokerName: 'Trade Republic Bank GmbH',
    platformType: 'BROKER',
    brokerSymbol: 'IE00BK5BQT80 (VWCE)',
    brokerInstrumentName: 'Vanguard FTSE All-World UCITS ETF USD Acc',
    contractType: 'ETF_SHARE',
    currency: 'EUR',
    venueLabel: 'Lang & Schwarz Exchange (LS Exchange)',
    verificationStatus: 'VERIFIED',
    verificationSource: 'ISIN ufficiale IE00BK5BQT80 armonizzato UCITS',
    commissionNotes: '1,00 EUR per ordine singolo; disponibile per piano di accumulo (PAC) periodico.',
    tradingConditionsNotes: 'ETF fisico ad accumulazione in EUR. Preferire esecuzione negli orari di apertura Xetra (09:00–17:30 CET) per spread ottimali.',
    lastVerifiedAt: '2026-10-15T10:00:00Z',
  },
  {
    id: 'MAP_TR_BTC',
    instrumentId: 'INST_BTC_USD_SPOT',
    underlyingAssetId: 'ASSET_BTC',
    brokerCode: 'TRADE_REPUBLIC',
    brokerName: 'Trade Republic Bank GmbH',
    platformType: 'BROKER',
    brokerSymbol: 'BTC (XF000BTC0017)',
    brokerInstrumentName: 'Bitcoin (Custodia regolamentata tramite partner crypto)',
    contractType: 'SPOT',
    currency: 'EUR',
    venueLabel: 'Bankhaus Scheich / Tradias OTC',
    verificationStatus: 'USER_CONFIRMED',
    verificationSource: 'Identificazione manuale confermata (senza uso di API private non autorizzate)',
    commissionNotes: '1,00 EUR per ordine + spread OTC implicito applicato dal market maker crypto.',
    tradingConditionsNotes: 'Negoziazione 24/7 in EUR. Nota: il prezzo mostrato dal provider CoinGecko è una media globale spot USD/EUR e può differire dallo spread OTC applicato da Trade Republic.',
    lastVerifiedAt: '2026-10-15T10:00:00Z',
  },

  // --- INTERACTIVE BROKERS (IBKR) ---
  {
    id: 'MAP_IBKR_AAPL',
    instrumentId: 'INST_AAPL_XNGS_EQ',
    underlyingAssetId: 'ASSET_AAPL',
    brokerCode: 'IBKR',
    brokerName: 'Interactive Brokers',
    platformType: 'BROKER',
    brokerSymbol: 'AAPL (SMART / NASDAQ)',
    brokerInstrumentName: 'APPLE INC - Common Stock (US0378331005)',
    contractType: 'CASH_SHARE',
    currency: 'USD',
    venueLabel: 'NASDAQ (XNGS) / IB SmartRouting',
    verificationStatus: 'VERIFIED',
    verificationSource: 'Catalogo pubblico IBKR Contract Database (ISIN US0378331005)',
    tickSize: 0.01,
    commissionNotes: 'Piano Tiered/Fixed USD (min. ~0.35–1.00 USD per ordine) + eventuale conversione valutaria EUR/USD.',
    tradingConditionsNotes: 'Accesso diretto a NASDAQ in USD (Regular Hours 09:30–16:00 ET + Extended Hours).',
    officialExternalUrl: 'https://www.interactivebrokers.com',
    lastVerifiedAt: '2026-10-15T10:00:00Z',
  },
  {
    id: 'MAP_IBKR_IBM',
    instrumentId: 'INST_IBM_XNYS_EQ',
    underlyingAssetId: 'ASSET_IBM',
    brokerCode: 'IBKR',
    brokerName: 'Interactive Brokers',
    platformType: 'BROKER',
    brokerSymbol: 'IBM (SMART / NYSE)',
    brokerInstrumentName: 'INTL BUSINESS MACHINES CORP (US4592001014)',
    contractType: 'CASH_SHARE',
    currency: 'USD',
    venueLabel: 'NYSE (XNYS) / IB SmartRouting',
    verificationStatus: 'VERIFIED',
    verificationSource: 'Catalogo pubblico IBKR Contract Database (ISIN US4592001014)',
    tickSize: 0.01,
    commissionNotes: 'Piano Tiered/Fixed USD + costi cambio valuta.',
    tradingConditionsNotes: 'Accesso diretto al NYSE (09:30–16:00 ET).',
    lastVerifiedAt: '2026-10-15T10:00:00Z',
  },

  // --- AVATRADE (CFD) ---
  {
    id: 'MAP_AVA_BTC_CFD',
    instrumentId: 'INST_BTC_CFD_DERIV',
    underlyingAssetId: 'ASSET_BTC',
    brokerCode: 'AVATRADE',
    brokerName: 'AvaTrade EU Ltd',
    platformType: 'BROKER',
    brokerSymbol: 'BTCUSD',
    brokerInstrumentName: 'Bitcoin vs US Dollar CFD',
    contractType: 'CFD',
    currency: 'USD',
    venueLabel: 'AvaTrade OTC Dealing Desk',
    verificationStatus: 'VERIFIED',
    verificationSource: 'Specifiche contrattuali pubbliche AvaTrade CFD Crypto',
    maxLeverage: 2,
    contractSize: 1,
    tickSize: 0.01,
    typicalSpreadBps: 50,
    commissionNotes: 'Zero commissioni esplicite, costo incorporato nello spread bid/ask + swap overnight giornaliero.',
    tradingConditionsNotes: 'Strumento derivato OTC con leva ESMA 1:2 per clienti retail.',
    spotVsDerivativeWarning: 'ATTENZIONE CRITICA: Su AvaTrade questo strumento è un CFD (Contratto per Differenza) e NON l\'acquisto dell\'asset Bitcoin spot reale. Il prezzo spot globale non coincide con il prezzo eseguibile bid/ask del CFD e comporta costi di mantenimento overnight (swap).',
    lastVerifiedAt: '2026-10-15T10:00:00Z',
  },
  {
    id: 'MAP_AVA_EURUSD',
    instrumentId: 'INST_EURUSD_FX',
    underlyingAssetId: 'ASSET_EURUSD',
    brokerCode: 'AVATRADE',
    brokerName: 'AvaTrade EU Ltd',
    platformType: 'BROKER',
    brokerSymbol: 'EURUSD',
    brokerInstrumentName: 'EUR/USD Forex CFD',
    contractType: 'CFD',
    currency: 'USD',
    venueLabel: 'AvaTrade OTC Forex',
    verificationStatus: 'VERIFIED',
    verificationSource: 'Tabella condizioni di trading Forex AvaTrade',
    maxLeverage: 30,
    contractSize: 100000,
    tickSize: 0.00001,
    typicalSpreadBps: 0.9,
    commissionNotes: 'Remunerazione tramite spread bid/ask (tipico ~0.9 pip) + finanziamento overnight.',
    tradingConditionsNotes: 'Leva massima retail ESMA 1:30. Dimensione lotto standard: 100.000 unità.',
    spotVsDerivativeWarning: 'Strumento negoziato come CFD/Margin Forex OTC; non utilizzabile come cambio valutario contabile fisico.',
    lastVerifiedAt: '2026-10-15T10:00:00Z',
  },

  // --- METATRADER 4 / 5 (TERMINALI MULTI-BROKER) ---
  {
    id: 'MAP_MT5_EURUSD',
    instrumentId: 'INST_EURUSD_FX',
    underlyingAssetId: 'ASSET_EURUSD',
    brokerCode: 'MT5',
    brokerName: 'Terminale MetaTrader 5 (Multi-Broker)',
    platformType: 'TERMINAL',
    brokerSymbol: 'EURUSD (Dipende dal server broker connesso)',
    brokerInstrumentName: 'Euro vs US Dollar',
    contractType: 'CFD',
    currency: 'USD',
    venueLabel: 'Server Broker MT5 Configurato',
    verificationStatus: 'UNVERIFIED',
    verificationSource: 'MetaTrader 5 è un terminale software: il suffisso del simbolo (es. EURUSD, EURUSD.m, EURUSD.pro) dipende dal broker connesso. Importa il CSV dal tuo terminale per verificarlo.',
    contractSize: 100000,
    tickSize: 0.00001,
    commissionNotes: 'Dipende dal tipo di conto MT5 (Standard Spread-only vs ECN Raw Spread + commissione per lotto).',
    tradingConditionsNotes: 'Importa l\'elenco simboli del tuo server MT4/MT5 tramite la funzione di importazione CSV nella scheda Broker Mapping.',
    spotVsDerivativeWarning: 'MetaTrader 4/5 è un terminale di negoziazione, non un broker. Verifica sempre il suffisso simbolo e la dimensione contratto del tuo specifico intermediario.',
    lastVerifiedAt: '2026-10-15T10:00:00Z',
  },
];

/**
 * Risolve univocamente uno strumento senza affidarsi al solo ticker.
 * Priorità:
 * 1. ID canonico strumento (`INST_...`)
 * 2. ISIN + MIC
 * 3. CoinGecko ID + valuta
 * 4. Contract Address + Blockchain
 * 5. Combinazione (Ticker + Venue MIC + Asset Class)
 */
export function resolveInstrumentIdentity(
  query: {
    instrumentId?: string;
    isin?: string;
    coingeckoId?: string;
    contractAddress?: string;
    ticker?: string;
    venueMic?: string;
    assetClass?: AssetClass;
  },
  instruments: NegotiableInstrument[] = INITIAL_NEGOTIABLE_INSTRUMENTS,
  assets: UnderlyingAsset[] = INITIAL_UNDERLYING_ASSETS
): {
  instrument: NegotiableInstrument | null;
  underlyingAsset: UnderlyingAsset | null;
  matchMethod: 'EXACT_ID' | 'ISIN_MIC' | 'COINGECKO_ID' | 'CONTRACT_ADDRESS' | 'COMPOSITE_TICKER_VENUE' | 'AMBIGUOUS_TICKER_REJECTED' | 'NOT_FOUND';
  ambiguityWarning?: string;
} {
  if (query.instrumentId) {
    const inst = instruments.find((i) => i.id === query.instrumentId) || null;
    const asset = inst ? assets.find((a) => a.id === inst.underlyingAssetId) || null : null;
    if (inst) return { instrument: inst, underlyingAsset: asset, matchMethod: 'EXACT_ID' };
  }

  if (query.isin) {
    const cleanIsin = query.isin.trim().toUpperCase();
    const candidates = instruments.filter((i) => i.isin?.toUpperCase() === cleanIsin);
    if (candidates.length === 1) {
      const inst = candidates[0];
      return {
        instrument: inst,
        underlyingAsset: assets.find((a) => a.id === inst.underlyingAssetId) || null,
        matchMethod: 'ISIN_MIC',
      };
    }
    if (candidates.length > 1 && query.venueMic) {
      const byVenue = candidates.find((i) => i.venueMic === query.venueMic);
      if (byVenue) {
        return {
          instrument: byVenue,
          underlyingAsset: assets.find((a) => a.id === byVenue.underlyingAssetId) || null,
          matchMethod: 'ISIN_MIC',
        };
      }
    }
  }

  if (query.coingeckoId) {
    const cg = query.coingeckoId.trim().toLowerCase();
    const inst = instruments.find((i) => i.coingeckoId?.toLowerCase() === cg && !i.isDerivative);
    if (inst) {
      return {
        instrument: inst,
        underlyingAsset: assets.find((a) => a.id === inst.underlyingAssetId) || null,
        matchMethod: 'COINGECKO_ID',
      };
    }
  }

  if (query.contractAddress) {
    const addr = query.contractAddress.trim().toLowerCase();
    const asset = assets.find((a) => a.contractAddress?.toLowerCase() === addr);
    if (asset) {
      const inst = instruments.find((i) => i.underlyingAssetId === asset.id && !i.isDerivative) || null;
      return {
        instrument: inst,
        underlyingAsset: asset,
        matchMethod: 'CONTRACT_ADDRESS',
      };
    }
  }

  if (query.ticker) {
    const cleanTicker = query.ticker.trim().toUpperCase();
    const matches = instruments.filter(
      (i) =>
        i.ticker.toUpperCase() === cleanTicker ||
        i.providerSymbol.toUpperCase() === cleanTicker ||
        i.baseAssetSymbol?.toUpperCase() === cleanTicker
    );

    if (matches.length === 1) {
      const inst = matches[0];
      return {
        instrument: inst,
        underlyingAsset: assets.find((a) => a.id === inst.underlyingAssetId) || null,
        matchMethod: 'COMPOSITE_TICKER_VENUE',
      };
    }

    if (matches.length > 1) {
      const filtered = matches.filter((m) => {
        if (query.venueMic && m.venueMic !== query.venueMic) return false;
        if (query.assetClass && m.assetClass !== query.assetClass) return false;
        return true;
      });
      if (filtered.length === 1) {
        const inst = filtered[0];
        return {
          instrument: inst,
          underlyingAsset: assets.find((a) => a.id === inst.underlyingAssetId) || null,
          matchMethod: 'COMPOSITE_TICKER_VENUE',
        };
      }
      return {
        instrument: null,
        underlyingAsset: null,
        matchMethod: 'AMBIGUOUS_TICKER_REJECTED',
        ambiguityWarning: `Il simbolo "${cleanTicker}" corrisponde a ${matches.length} strumenti distinti (${matches.map((m) => `${m.ticker} [${m.instrumentType} su ${m.venueMic}]`).join(', ')}). Specifica ISIN, CoinGecko ID o Mercato (MIC) per evitare collisioni.`,
      };
    }
  }

  return { instrument: null, underlyingAsset: null, matchMethod: 'NOT_FOUND' };
}

/**
 * Importa da CSV un elenco strumenti esportato da MetaTrader 4 / MetaTrader 5 o altro broker.
 * Formato atteso CSV (con intestazione):
 * broker_code,broker_symbol,instrument_id,description,contract_type,currency,contract_size,tick_size,spread_bps
 */
export function parseBrokerMappingsCsv(
  csvText: string,
  existingInstruments: NegotiableInstrument[] = INITIAL_NEGOTIABLE_INSTRUMENTS
): {
  imported: BrokerInstrumentMapping[];
  errors: string[];
} {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length < 2) {
    return {
      imported: [],
      errors: ['Il file CSV deve contenere una riga di intestazione e almeno una riga dati valida.'],
    };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const requiredCols = ['broker_code', 'broker_symbol', 'instrument_id'];
  for (const col of requiredCols) {
    if (!headers.includes(col)) {
      return {
        imported: [],
        errors: [`Colonna obbligatoria mancante nel CSV: "${col}". Intestazione attesa: broker_code,broker_symbol,instrument_id,description,contract_type,currency,contract_size,tick_size,spread_bps`],
      };
    }
  }

  const imported: BrokerInstrumentMapping[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] || '';
    });

    const inst = existingInstruments.find((item) => item.id === row.instrument_id);
    if (!inst) {
      errors.push(`Riga ${i + 1}: instrument_id "${row.instrument_id}" non presente nel Registro Universale Strumenti.`);
      continue;
    }

    if (!row.broker_symbol) {
      errors.push(`Riga ${i + 1}: broker_symbol vuoto.`);
      continue;
    }

    const contractType = (['SPOT', 'CASH_SHARE', 'ETF_SHARE', 'CFD', 'PERPETUAL', 'FUTURE'].includes(
      (row.contract_type || '').toUpperCase()
    )
      ? row.contract_type.toUpperCase()
      : 'CFD') as ContractType;

    const brokerCode = (row.broker_code || 'MT5').toUpperCase();
    const isTerminals = brokerCode === 'MT4' || brokerCode === 'MT5';
    const platformType: PlatformType = isTerminals ? 'TERMINAL' : 'BROKER';

    imported.push({
      id: `CSV_${brokerCode}_${row.broker_symbol}_${Date.now()}_${i}`,
      instrumentId: inst.id,
      underlyingAssetId: inst.underlyingAssetId,
      brokerCode,
      brokerName: isTerminals ? `MetaTrader (${brokerCode})` : brokerCode,
      platformType,
      brokerSymbol: row.broker_symbol,
      brokerInstrumentName: row.description || `${inst.name} (${row.broker_symbol})`,
      contractType,
      currency: (row.currency || inst.quoteCurrency).toUpperCase(),
      venueLabel: `Importato da CSV (${brokerCode})`,
      verificationStatus: 'USER_CONFIRMED',
      verificationSource: 'Importazione manuale CSV confermata dall\'utente',
      contractSize: row.contract_size ? Number(row.contract_size) : undefined,
      tickSize: row.tick_size ? Number(row.tick_size) : undefined,
      typicalSpreadBps: row.spread_bps ? Number(row.spread_bps) : undefined,
      commissionNotes: 'Condizioni importate manualmente tramite CSV.',
      tradingConditionsNotes: 'Corrispondenza registrata dall\'utente per il proprio conto/terminale.',
      spotVsDerivativeWarning:
        contractType === 'CFD' || contractType === 'FUTURE' || contractType === 'PERPETUAL'
          ? 'Strumento derivato: il prezzo del sottostante spot non equivale al prezzo eseguibile del contratto derivato.'
          : undefined,
      lastVerifiedAt: new Date().toISOString(),
    });
  }

  return { imported, errors };
}

/**
 * Calcola lo stato di apertura/chiusura delle borse tenendo conto di fuso orario e weekend.
 */
export function getMarketVenueStatus(
  venueMic: string,
  nowUtc: Date = new Date()
): {
  venue: TradingVenue;
  isOpen: boolean;
  localTimeStr: string;
  statusLabel: string;
} {
  const venue = TRADING_VENUES[venueMic] || TRADING_VENUES.CRYPTO_GLOBAL;
  if (venue.is24x7) {
    return {
      venue,
      isOpen: true,
      localTimeStr: nowUtc.toISOString().slice(11, 16) + ' UTC',
      statusLabel: 'Aperto 24/7',
    };
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: venue.timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(nowUtc);
    const weekday = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
    const hour = parts.find((p) => p.type === 'hour')?.value || '00';
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';
    const localTimeStr = `${hour}:${minute}`;

    if (weekday === 'Sat' || weekday === 'Sun') {
      return {
        venue,
        isOpen: false,
        localTimeStr,
        statusLabel: 'Chiuso (Weekend)',
      };
    }

    const currentMinutes = Number(hour) * 60 + Number(minute);
    const [openH, openM] = venue.openTime.split(':').map(Number);
    const [closeH, closeM] = venue.closeTime.split(':').map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    const isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    return {
      venue,
      isOpen,
      localTimeStr,
      statusLabel: isOpen
        ? `Mercato Aperto (${venue.openTime}–${venue.closeTime})`
        : `Mercato Chiuso (Orario: ${venue.openTime}–${venue.closeTime})`,
    };
  } catch {
    return {
      venue,
      isOpen: false,
      localTimeStr: nowUtc.toISOString().slice(11, 16) + ' UTC',
      statusLabel: 'Stato sessione non determinabile',
    };
  }
}
