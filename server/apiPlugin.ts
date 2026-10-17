// ==============================================================================
// DEMINVEST — BACKEND HTTP API MIDDLEWARE & BACKGROUND SCHEDULER DAEMON
// ==============================================================================

import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import './nodePlatformBridge';
import {
  dispatchNotificationAndWebPush,
  fetchLiveFxRatesToBase,
  getDbState,
  getHistoricalCandlesForInstrument,
  getMarketQuoteForInstrument,
  getOrInitVapidKeys,
  getProvidersHealthDashboard,
  processContextualAiChat,
  registerCoinGeckoInstrumentInCatalog,
  runBackendSchedulerCycle,
  saveDbState,
  saveRuntimeSecret,
  searchCatalogAndLiveProviders,
} from './backendEngine';
import { parseBrokerMappingsCsv } from '../src/engines/instrumentRegistry';
import { computeQuantitativeSnapshot } from '../src/engines/quantitativeEngine';
import { evaluateDeterministicSignal } from '../src/engines/signalIntelligenceEngine';
import {
  calculatePortfolioAnalytics,
  importPortfolioTransactionsCsv,
} from '../src/engines/portfolioEngine';
import {
  executeSimulatedPaperOrder,
  runDeterministicBacktest,
} from '../src/engines/paperAndBacktestEngine';
import {
  AlertRule,
  BrokerInstrumentMapping,
  CandleTimeframe,
  DataExecutionMode,
  MarketQuote,
  PortfolioTransaction,
  TimeHorizon,
} from '../src/types/domain';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`deminvest_salt_v1::${password}`).digest('hex');
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 2_000_000) {
        reject(new Error('Payload troppo grande'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('JSON non valido'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.end(JSON.stringify(payload));
}

let schedulerIntervalHandle: ReturnType<typeof setInterval> | null = null;

function ensureBackgroundSchedulerStarted() {
  if (schedulerIntervalHandle) return;
  schedulerIntervalHandle = setInterval(() => {
    const db = getDbState();
    const mode = db.ownerAccount?.user.dataExecutionMode || 'LIVE';
    runBackendSchedulerCycle(mode).catch(() => {
      // Gestito internamente nel log scheduler
    });
  }, 180 * 1000);
  if (typeof schedulerIntervalHandle.unref === 'function') {
    schedulerIntervalHandle.unref();
  }
}

export function demInvestBackendPlugin(): Plugin {

  const handleApiRequest = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ) => {
    const rawUrl = req.url || '';
    if (!rawUrl.startsWith('/api/')) {
      return next();
    }

    const urlObj = new URL(rawUrl, 'http://localhost');
    const pathname = urlObj.pathname;
    const method = req.method || 'GET';

    try {
      const db = getDbState();

      // 1. BOOTSTRAP STATO APPLICAZIONE
      if (pathname === '/api/bootstrap' && method === 'GET') {
        const vapid = getOrInitVapidKeys();
        const isAuthenticated = Boolean(
          db.ownerAccount && db.activeSessionToken
        );
        return sendJson(res, 200, {
          singleUserMode: db.singleUserMode,
          hasOwnerAccount: Boolean(db.ownerAccount),
          isAuthenticated,
          user: isAuthenticated ? db.ownerAccount?.user : null,
          assets: db.assets,
          instruments: db.instruments,
          brokerMappings: db.brokerMappings,
          watchlistInstrumentIds: db.watchlistInstrumentIds,
          alertRules: db.alertRules,
          generatedSignals: db.generatedSignals,
          notifications: db.notifications,
          portfolioTransactions: db.portfolioTransactions,
          paperAccount: db.paperAccount,
          journalEntries: db.journalEntries,
          aiMessages: db.aiMessages,
          aiToolLogs: db.aiToolLogs,
          schedulerStatus: db.schedulerStatus,
          providersHealth: getProvidersHealthDashboard(),
          vapidPublicKey: vapid.publicKey,
        });
      }

      // 2. AUTENTICAZIONE E SINGLE_USER_MODE
      if (pathname === '/api/auth/register' && method === 'POST') {
        const body = await readJsonBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        const displayName = String(body.displayName || 'Investitore Proprietario').trim();

        if (!email || !email.includes('@') || password.length < 8) {
          return sendJson(res, 400, {
            error: 'Inserisci un indirizzo email valido e una password di almeno 8 caratteri.',
          });
        }

        if (db.singleUserMode && db.ownerAccount !== null) {
          return sendJson(res, 403, {
            error:
              'SINGLE_USER_MODE attiva: DemInvest è un\'istanza personale privata. Il proprietario è già stato registrato e non sono consentite ulteriori registrazioni pubbliche.',
          });
        }

        const token = crypto.randomBytes(24).toString('hex');
        db.ownerAccount = {
          passwordHash: hashPassword(password),
          user: {
            id: 'OWNER_USER_01',
            email,
            displayName,
            isOwner: true,
            onboardingCompleted: false,
            uiMode: 'SIMPLE',
            theme: 'DARK',
            dataExecutionMode: 'LIVE',
            preferredCurrency: 'EUR',
            timezone: 'Europe/Rome',
            experienceLevel: 'INTERMEDIATE',
            riskTolerance: 'MODERATE',
            investmentGoals: ['CAPITAL_GROWTH', 'RISK_CONTROL'],
            preferredHorizons: ['BREVE', 'MEDIO', 'LUNGO'],
            preferredMarkets: ['CRYPTO', 'EQUITY', 'ETF'],
            selectedBrokers: ['TRADE_REPUBLIC', 'IBKR', 'AVATRADE', 'MT5'],
            quietHoursStart: '22:30',
            quietHoursEnd: '07:30',
            maxDailyNotifications: 15,
            createdAt: new Date().toISOString(),
          },
        };
        db.activeSessionToken = token;
        saveDbState(db);

        return sendJson(res, 200, {
          user: db.ownerAccount.user,
          sessionToken: token,
        });
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await readJsonBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');

        if (!db.ownerAccount) {
          return sendJson(res, 404, {
            error: 'Nessun account proprietario registrato. Esegui la registrazione iniziale.',
          });
        }

        if (
          db.ownerAccount.user.email !== email ||
          db.ownerAccount.passwordHash !== hashPassword(password)
        ) {
          return sendJson(res, 401, {
            error: 'Credenziali non valide. Verifica email e password del proprietario.',
          });
        }

        const token = crypto.randomBytes(24).toString('hex');
        db.activeSessionToken = token;
        saveDbState(db);

        return sendJson(res, 200, {
          user: db.ownerAccount.user,
          sessionToken: token,
        });
      }

      if (pathname === '/api/auth/logout' && method === 'POST') {
        db.activeSessionToken = null;
        saveDbState(db);
        return sendJson(res, 200, { ok: true });
      }

      if (pathname === '/api/profile/update' && method === 'POST') {
        if (!db.ownerAccount) {
          return sendJson(res, 401, { error: 'Non autenticato' });
        }
        const body = await readJsonBody(req);
        db.ownerAccount.user = {
          ...db.ownerAccount.user,
          ...(body as Partial<typeof db.ownerAccount.user>),
        };
        saveDbState(db);
        return sendJson(res, 200, { user: db.ownerAccount.user });
      }

      // 3. MARKET DATA & QUANTITATIVE SNAPSHOT
      if (pathname === '/api/market/batch-quotes' && method === 'GET') {
        const mode = (urlObj.searchParams.get('mode') === 'DEMO' ? 'DEMO' : 'LIVE') as DataExecutionMode;
        const idsParam = urlObj.searchParams.get('ids');
        const targetIds = idsParam
          ? idsParam.split(',').filter(Boolean)
          : db.instruments.map((i) => i.id);

        const quotes: Record<string, MarketQuote> = {};
        await Promise.all(
          targetIds.map(async (id) => {
            try {
              quotes[id] = await getMarketQuoteForInstrument(id, mode);
            } catch {
              // skip invalid id
            }
          })
        );

        const fxTable = await fetchLiveFxRatesToBase(
          db.ownerAccount?.user.preferredCurrency || 'EUR'
        );
        const portfolioAnalytics = calculatePortfolioAnalytics({
          transactions: db.portfolioTransactions,
          quotesByInstrumentId: quotes,
          fxTable,
          instruments: db.instruments,
        });

        return sendJson(res, 200, {
          quotes,
          fxTable,
          portfolioAnalytics,
          providersHealth: getProvidersHealthDashboard(),
        });
      }

      if (pathname === '/api/market/instrument-analysis' && method === 'GET') {
        const instrumentId = urlObj.searchParams.get('instrumentId') || 'INST_BTC_USD_SPOT';
        const timeframe = (urlObj.searchParams.get('timeframe') || '1d') as CandleTimeframe;
        const horizon = (urlObj.searchParams.get('horizon') || 'BREVE') as TimeHorizon;
        const brokerCode = urlObj.searchParams.get('brokerCode') || 'TRADE_REPUBLIC';
        const mode = (urlObj.searchParams.get('mode') === 'DEMO' ? 'DEMO' : 'LIVE') as DataExecutionMode;

        const instrument = db.instruments.find((i) => i.id === instrumentId);
        if (!instrument) {
          return sendJson(res, 404, { error: `Strumento ${instrumentId} non trovato.` });
        }

        const [quote, candles] = await Promise.all([
          getMarketQuoteForInstrument(instrumentId, mode),
          getHistoricalCandlesForInstrument(instrumentId, timeframe, mode),
        ]);

        const indicators = computeQuantitativeSnapshot(
          instrumentId,
          timeframe,
          candles,
          instrument.assetClass === 'CRYPTO' ? 'CRYPTO' : 'OTHER'
        );

        const verifiedMapping = db.brokerMappings.find(
          (m) => m.instrumentId === instrumentId && m.brokerCode === brokerCode
        );

        const signalEvaluation = evaluateDeterministicSignal({
          instrument,
          quote,
          indicators,
          horizon,
          verifiedMapping,
        });

        return sendJson(res, 200, {
          instrument,
          quote,
          candles,
          indicators,
          signalEvaluation,
        });
      }

      if (pathname === '/api/market/search' && method === 'GET') {
        const q = urlObj.searchParams.get('q') || '';
        const results = await searchCatalogAndLiveProviders(q);
        return sendJson(res, 200, results);
      }

      if (pathname === '/api/market/register-coingecko' && method === 'POST') {
        const body = await readJsonBody(req);
        const inst = registerCoinGeckoInstrumentInCatalog({
          coingeckoId: String(body.coingeckoId || ''),
          symbol: String(body.symbol || ''),
          name: String(body.name || ''),
        });
        return sendJson(res, 200, {
          instrument: inst,
          instruments: getDbState().instruments,
          assets: getDbState().assets,
        });
      }

      // 4. BROKER MAPPING & CSV IMPORT
      if (pathname === '/api/broker/import-csv' && method === 'POST') {
        const body = await readJsonBody(req);
        const csvText = String(body.csvText || '');
        const { imported, errors } = parseBrokerMappingsCsv(csvText, db.instruments);
        if (imported.length > 0) {
          db.brokerMappings = [...imported, ...db.brokerMappings];
          saveDbState(db);
        }
        return sendJson(res, 200, {
          importedCount: imported.length,
          errors,
          brokerMappings: db.brokerMappings,
        });
      }

      if (pathname === '/api/broker/confirm-mapping' && method === 'POST') {
        const body = await readJsonBody(req);
        const inst = db.instruments.find((i) => i.id === String(body.instrumentId || ''));
        if (!inst) {
          return sendJson(res, 400, { error: 'Strumento non valido' });
        }
        const newMap: BrokerInstrumentMapping = {
          id: `MAP_USER_${Date.now()}`,
          instrumentId: inst.id,
          underlyingAssetId: inst.underlyingAssetId,
          brokerCode: String(body.brokerCode || 'TRADE_REPUBLIC').toUpperCase(),
          brokerName: String(body.brokerName || body.brokerCode || 'Broker Utente'),
          platformType:
            body.brokerCode === 'MT4' || body.brokerCode === 'MT5' ? 'TERMINAL' : 'BROKER',
          brokerSymbol: String(body.brokerSymbol || inst.ticker).trim(),
          brokerInstrumentName: String(body.brokerInstrumentName || inst.name).trim(),
          contractType: (body.contractType as BrokerInstrumentMapping['contractType']) || 'SPOT',
          currency: String(body.currency || inst.quoteCurrency).toUpperCase(),
          venueLabel: String(body.venueLabel || 'Confermato manualmente dall\'utente'),
          verificationStatus: 'USER_CONFIRMED',
          verificationSource: 'Registrazione manuale verificata dall\'utente sul proprio intermediario',
          commissionNotes: String(body.commissionNotes || 'Condizioni dichiarate dall\'utente'),
          tradingConditionsNotes: String(
            body.tradingConditionsNotes || 'Verificare orari e spread sul proprio terminale.'
          ),
          spotVsDerivativeWarning:
            body.contractType === 'CFD'
              ? 'Strumento derivato CFD: non equivale alla detenzione diretta del sottostante spot.'
              : undefined,
          lastVerifiedAt: new Date().toISOString(),
        };
        db.brokerMappings = [newMap, ...db.brokerMappings];
        saveDbState(db);
        return sendJson(res, 200, { brokerMappings: db.brokerMappings });
      }

      // 5. WATCHLIST & ALERT RULES
      if (pathname === '/api/watchlist/toggle' && method === 'POST') {
        const body = await readJsonBody(req);
        const instId = String(body.instrumentId || '');
        if (db.watchlistInstrumentIds.includes(instId)) {
          db.watchlistInstrumentIds = db.watchlistInstrumentIds.filter((id) => id !== instId);
        } else if (instId) {
          db.watchlistInstrumentIds.push(instId);
        }
        saveDbState(db);
        return sendJson(res, 200, { watchlistInstrumentIds: db.watchlistInstrumentIds });
      }

      if (pathname === '/api/alerts/create' && method === 'POST') {
        const body = await readJsonBody(req);
        const inst = db.instruments.find((i) => i.id === String(body.instrumentId || ''));
        if (!inst) {
          return sendJson(res, 400, { error: 'Strumento non trovato' });
        }
        const newRule: AlertRule = {
          id: `ALR_${Date.now()}`,
          instrumentId: inst.id,
          instrumentTicker: inst.ticker,
          brokerCode: body.brokerCode ? String(body.brokerCode) : undefined,
          ruleType: (body.ruleType as AlertRule['ruleType']) || 'PRICE_ABOVE',
          horizon: (body.horizon as TimeHorizon) || 'BREVE',
          thresholdValue: Number(body.thresholdValue || 0),
          priority: (body.priority as AlertRule['priority']) || 'MEDIUM',
          cooldownMinutes: Number(body.cooldownMinutes || 60),
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        db.alertRules = [newRule, ...db.alertRules];
        saveDbState(db);
        return sendJson(res, 200, { alertRules: db.alertRules });
      }

      if (pathname === '/api/alerts/toggle' && method === 'POST') {
        const body = await readJsonBody(req);
        const ruleId = String(body.ruleId || '');
        db.alertRules = db.alertRules.map((r) =>
          r.id === ruleId ? { ...r, isActive: !r.isActive } : r
        );
        saveDbState(db);
        return sendJson(res, 200, { alertRules: db.alertRules });
      }

      if (pathname === '/api/alerts/delete' && method === 'POST') {
        const body = await readJsonBody(req);
        const ruleId = String(body.ruleId || '');
        db.alertRules = db.alertRules.filter((r) => r.id !== ruleId);
        saveDbState(db);
        return sendJson(res, 200, { alertRules: db.alertRules });
      }

      // 6. WEB PUSH SUBSCRIPTION & REAL TEST NOTIFICATION
      if (pathname === '/api/push/subscribe' && method === 'POST') {
        const body = await readJsonBody(req);
        const sub = body.subscription as {
          endpoint?: string;
          keys?: { p256dh?: string; auth?: string };
        };
        if (sub && sub.endpoint && sub.keys?.p256dh && sub.keys?.auth) {
          const exists = db.pushSubscriptions.some((s) => s.endpoint === sub.endpoint);
          if (!exists) {
            db.pushSubscriptions.push({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
            });
            saveDbState(db);
          }
        }
        return sendJson(res, 200, {
          subscribedCount: db.pushSubscriptions.length,
        });
      }

      if (pathname === '/api/push/test' && method === 'POST') {
        const btcQuote = await getMarketQuoteForInstrument(
          'INST_BTC_USD_SPOT',
          db.ownerAccount?.user.dataExecutionMode || 'LIVE'
        );
        const notif = await dispatchNotificationAndWebPush({
          title: 'DemInvest — Test Reale Notifica Web Push (VAPID)',
          body: `Connessione Push Server-Side attiva. Riferimento BTC/USD: ${btcQuote.price} ${btcQuote.currency} (${btcQuote.providerName}).`,
          severity: 'INFO',
          providerSource: btcQuote.providerName,
          observedTimestamp: btcQuote.observedAt,
          instrumentId: 'INST_BTC_USD_SPOT',
          instrumentTicker: 'BTC/USD',
          horizon: 'BREVE',
          bypassQuietHours: true,
          quantitativeDetails: {
            signalStatus: 'CONFIRMED',
            rationale: 'Notifica di verifica infrastruttura Web Push VAPID inviata dal backend.',
            risks: ['Notifica di test tecnica avvio manuale dall\'utente.'],
          },
        });
        return sendJson(res, 200, {
          notification: notif,
          notifications: getDbState().notifications,
          pushSubscriptionsCount: getDbState().pushSubscriptions.length,
        });
      }

      if (pathname === '/api/notifications/mark-read' && method === 'POST') {
        const nowIso = new Date().toISOString();
        db.notifications = db.notifications.map((n) => ({
          ...n,
          deliveryStatus: 'READ',
          readAt: n.readAt || nowIso,
        }));
        saveDbState(db);
        return sendJson(res, 200, { notifications: db.notifications });
      }

      // 7. SCHEDULER MANUAL TRIGGER
      if (pathname === '/api/scheduler/run-now' && method === 'POST') {
        const body = await readJsonBody(req);
        const mode = (body.mode === 'DEMO' ? 'DEMO' : 'LIVE') as DataExecutionMode;
        const status = await runBackendSchedulerCycle(mode);
        const updatedDb = getDbState();
        return sendJson(res, 200, {
          schedulerStatus: status,
          generatedSignals: updatedDb.generatedSignals,
          notifications: updatedDb.notifications,
          alertRules: updatedDb.alertRules,
        });
      }

      // 8. PORTAFOGLIO MANUALE
      if (pathname === '/api/portfolio/transaction' && method === 'POST') {
        const body = await readJsonBody(req);
        const fxTable = await fetchLiveFxRatesToBase('EUR');
        const currency = String(body.currency || 'EUR').toUpperCase();
        const fxEntry = fxTable.ratesToBase[currency] || {
          rate: 1,
          source: 'ECB_FRANKFURTER',
          date: new Date().toISOString().slice(0, 10),
        };
        const inst = db.instruments.find((i) => i.id === String(body.instrumentId || ''));

        const tx: PortfolioTransaction = {
          id: `TX_${Date.now()}`,
          instrumentId: inst?.id,
          instrumentTicker: inst?.ticker,
          transactionType: (body.transactionType as PortfolioTransaction['transactionType']) || 'BUY',
          quantity: Number(body.quantity || 0),
          unitPrice: Number(body.unitPrice || 0),
          fees: Number(body.fees || 0),
          currency,
          fxRateToBase: currency === 'EUR' ? 1 : fxEntry.rate,
          fxSource: currency === 'EUR' ? 'IDENTITY_SAME_CURRENCY' : fxEntry.source,
          fxObservedAt: new Date().toISOString(),
          declaredBrokerCode: String(body.declaredBrokerCode || 'TRADE_REPUBLIC'),
          executedAt: String(body.executedAt || new Date().toISOString()),
          notes: body.notes ? String(body.notes) : undefined,
        };

        db.portfolioTransactions = [tx, ...db.portfolioTransactions];
        saveDbState(db);
        return sendJson(res, 200, {
          portfolioTransactions: db.portfolioTransactions,
        });
      }

      if (pathname === '/api/portfolio/delete-transaction' && method === 'POST') {
        const body = await readJsonBody(req);
        const txId = String(body.transactionId || '');
        db.portfolioTransactions = db.portfolioTransactions.filter((t) => t.id !== txId);
        saveDbState(db);
        return sendJson(res, 200, {
          portfolioTransactions: db.portfolioTransactions,
        });
      }

      if (pathname === '/api/portfolio/import-csv' && method === 'POST') {
        const body = await readJsonBody(req);
        const { transactions, errors } = importPortfolioTransactionsCsv(String(body.csvText || ''));
        if (transactions.length > 0) {
          db.portfolioTransactions = [...transactions, ...db.portfolioTransactions];
          saveDbState(db);
        }
        return sendJson(res, 200, {
          importedCount: transactions.length,
          errors,
          portfolioTransactions: db.portfolioTransactions,
        });
      }

      // 9. PAPER TRADING & STRATEGY BACKTESTING
      if (pathname === '/api/paper/order' && method === 'POST') {
        const body = await readJsonBody(req);
        const instId = String(body.instrumentId || 'INST_BTC_USD_SPOT');
        const mode = (body.mode === 'DEMO' ? 'DEMO' : 'LIVE') as DataExecutionMode;
        const inst = db.instruments.find((i) => i.id === instId);
        if (!inst) {
          return sendJson(res, 400, { error: 'Strumento non trovato' });
        }
        const quote = await getMarketQuoteForInstrument(instId, mode);
        const { updatedAccount, order } = executeSimulatedPaperOrder({
          account: db.paperAccount,
          instrumentId: inst.id,
          ticker: inst.ticker,
          name: inst.name,
          side: body.side === 'SELL' ? 'SELL' : 'BUY',
          quantity: Number(body.quantity || 0),
          quote,
          customSpreadBps: body.spreadBps !== undefined ? Number(body.spreadBps) : undefined,
          customSlippageBps: body.slippageBps !== undefined ? Number(body.slippageBps) : undefined,
          customCommissionPct:
            body.commissionPct !== undefined ? Number(body.commissionPct) : undefined,
          stopLoss: body.stopLoss ? Number(body.stopLoss) : undefined,
          takeProfit: body.takeProfit ? Number(body.takeProfit) : undefined,
          rationaleNotes: body.rationaleNotes ? String(body.rationaleNotes) : undefined,
        });

        db.paperAccount = updatedAccount;
        saveDbState(db);
        return sendJson(res, 200, {
          paperAccount: db.paperAccount,
          order,
        });
      }

      if (pathname === '/api/paper/reset' && method === 'POST') {
        const body = await readJsonBody(req);
        const initialCapital = Math.max(100, Number(body.initialCapital || 25000));
        db.paperAccount = {
          name: 'Conto Paper Trading DemInvest (Virtuale)',
          baseCurrency: 'USD',
          initialCapital,
          cashBalance: initialCapital,
          defaultSpreadBps: Number(body.defaultSpreadBps ?? 12),
          defaultSlippageBps: Number(body.defaultSlippageBps ?? 8),
          defaultCommissionPct: Number(body.defaultCommissionPct ?? 0.1),
          orders: [],
          positions: [],
          realizedPnlTotal: 0,
          unrealizedPnlTotal: 0,
          totalEquity: initialCapital,
          maxDrawdownPct: 0,
        };
        saveDbState(db);
        return sendJson(res, 200, { paperAccount: db.paperAccount });
      }

      if (pathname === '/api/lab/backtest' && method === 'POST') {
        const body = await readJsonBody(req);
        const instId = String(body.instrumentId || 'INST_BTC_USD_SPOT');
        const strategyId = String(body.strategyId || 'STRAT_SMA_CROSS_10_20_V1');
        const timeframe = (body.timeframe || '1d') as CandleTimeframe;
        const mode = (body.mode === 'DEMO' ? 'DEMO' : 'LIVE') as DataExecutionMode;

        const inst = db.instruments.find((i) => i.id === instId);
        if (!inst) {
          return sendJson(res, 400, { error: 'Strumento non trovato' });
        }
        const candles = await getHistoricalCandlesForInstrument(instId, timeframe, mode);
        const result = runDeterministicBacktest({
          strategyId,
          instrumentId: inst.id,
          instrumentTicker: inst.ticker,
          providerId: candles[0]?.providerId || inst.primaryProviderId,
          timeframe,
          rawCandles: candles,
          initialCapital: Number(body.initialCapital || 10000),
          commissionPct: Number(body.commissionPct ?? 0.1),
          spreadBps: Number(body.spreadBps ?? 12),
          slippageBps: Number(body.slippageBps ?? 8),
          maxRiskPerTradePct: Number(body.maxRiskPerTradePct ?? 2.0),
        });
        return sendJson(res, 200, { backtestResult: result });
      }

      if (pathname === '/api/lab/journal' && method === 'POST') {
        const body = await readJsonBody(req);
        const entry = {
          id: `JRN_${Date.now()}`,
          instrumentId: body.instrumentId ? String(body.instrumentId) : undefined,
          title: String(body.title || 'Nota di ricerca').trim(),
          hypothesis: String(body.hypothesis || '').trim(),
          outcomeReview: String(body.outcomeReview || '').trim(),
          emotionalState: String(body.emotionalState || 'Neutrale').trim(),
          lessonsLearned: String(body.lessonsLearned || '').trim(),
          createdAt: new Date().toISOString(),
        };
        db.journalEntries = [entry, ...db.journalEntries];
        saveDbState(db);
        return sendJson(res, 200, { journalEntries: db.journalEntries });
      }

      // 10. DEMINVEST AI CHAT
      if (pathname === '/api/ai/chat' && method === 'POST') {
        const body = await readJsonBody(req);
        const reply = await processContextualAiChat({
          userPrompt: String(body.prompt || ''),
          contextInstrumentId: String(body.contextInstrumentId || 'INST_BTC_USD_SPOT'),
          activeHorizon: (body.activeHorizon as TimeHorizon) || 'BREVE',
          selectedBrokerCode: String(body.selectedBrokerCode || 'TRADE_REPUBLIC'),
          dataExecutionMode: (body.dataExecutionMode === 'DEMO' ? 'DEMO' : 'LIVE') as DataExecutionMode,
        });
        const updated = getDbState();
        return sendJson(res, 200, {
          reply,
          aiMessages: updated.aiMessages,
          aiToolLogs: updated.aiToolLogs,
        });
      }

      // 11. CONFIGURAZIONE SEGRETI PROVIDER BACKEND-ONLY
      if (pathname === '/api/settings/provider-key' && method === 'POST') {
        const body = await readJsonBody(req);
        const providerKeyName = String(body.keyName || '') as
          | 'COINGECKO_API_KEY'
          | 'TWELVE_DATA_API_KEY'
          | 'ALPHA_VANTAGE_API_KEY'
          | 'FRED_API_KEY'
          | 'GEMINI_API_KEY';
        const allowedKeys = [
          'COINGECKO_API_KEY',
          'TWELVE_DATA_API_KEY',
          'ALPHA_VANTAGE_API_KEY',
          'FRED_API_KEY',
          'GEMINI_API_KEY',
        ];
        if (!allowedKeys.includes(providerKeyName)) {
          return sendJson(res, 400, { error: 'Nome variabile provider non riconosciuto.' });
        }
        saveRuntimeSecret(providerKeyName, String(body.secretValue || ''));
        return sendJson(res, 200, {
          ok: true,
          providersHealth: getProvidersHealthDashboard(),
        });
      }

      return sendJson(res, 404, { error: `Endpoint API ${pathname} non trovato.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore interno del server';
      return sendJson(res, 500, { error: msg });
    }
  };

  return {
    name: 'deminvest-backend-api-plugin',
    configureServer(server) {
      ensureBackgroundSchedulerStarted();
      server.middlewares.use(handleApiRequest);
    },
    configurePreviewServer(server) {
      ensureBackgroundSchedulerStarted();
      server.middlewares.use(handleApiRequest);
    },
  };
}
