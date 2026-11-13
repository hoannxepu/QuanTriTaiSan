/**
 * Default empty/starter state for new registered accounts in Cloudflare D1 / SQLite
 */
export const INITIAL_DATABASE_STATE = {
  assets: [],
  debts: [],
  goals: [],
  transactions: [],
  monthlyIncomes: [],
  incomeItems: [],
  monthlyObligations: [],
  deletedMonths: [],
  deletedObligationMonths: [],
  lastUpdate: new Date().toISOString(),
  stockWatchlist: ['HPG', 'FPT', 'TCB', 'MBB', 'SSI', 'MWG', 'VNM'],
  lifeEvents: [],
  foodPlaces: [],
};
