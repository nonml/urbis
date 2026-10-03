# M22 — Money, shops and business

From: `docs/plan/features/mechanics.md` GAP-10-001 to GAP-10-037 (GAP-10-012 is M14-11's,
GAP-10-015 is M13-12's); `docs/plan/CAPABILITIES.md` G18, G19's upgrades, G20's shops,
G27, and C11's selling and vendors. When it closes, the player buys from every shop,
kiosk and machine, sells what they find, banks, gambles, plays the stock market the city's
own firms move, and runs businesses that grow with staff and equipment; and the city's
economy runs on firms that buy, sell, hire, profit and go bust, with prices that follow
supply and demand. Pillars: build it, live in it (money flows both ways between the
builder and the street).

Needs first: M11-4 (buying buildings), M11-5 (cred), M14-14 (goods), M15-15 (rent),
M16-10 (fishing boats), M13-12 (the gun shop), M27 (the phone), M33 (interiors).
Lane: city, with the shops in lane: street.

## Keys

None new. **E** at a counter, kiosk or machine buys (E uses what is in front); the shop's
menu is mouse-driven; **Esc** leaves it.

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M22-1 | **Shops sell:** E at any open shop's counter, a kiosk or a vending machine opens its stock: food and drink (eating restores up to 30 health, M13-1), snacks, goods by the shop's kind (a 24/7 store, a chemist, an electronics shop, a hardware shop); each sale takes ₡ and the item goes to the inventory (M25). Every grown shop of the right kind sells, its stock from `shops.json`; vending machines stand on streets and in lobbies from the map's dressing | `tests/accept/m22-shops.spec.js` | partial: a keeper behind the noodle bar's counter; nothing is sold (`INTERIORS.md`) | GAP-10-001, GAP-10-002 |
| M22-2 | **Stock that changes:** a vendor's stock improves with the player's level (M23), refills over 1-2 game days, and its prices fall up to 20% as the player's standing with the district rises (M21-5) | `tests/m22-vendors.test.js` | red | GAP-10-035, GAP-10-036, GAP-10-037 |
| M22-3 | **Earning and selling:** gigs (M11) and missions pay, with a bonus for each optional goal; money caches in hacked places (M20) and access points pay; any item can be sold to a vendor who deals in it, junk to a pawn shop, and stolen goods only to a fence or the black market, which also buys weapons; drop points take loot for ₡ without a vendor | `tests/m22-earn.test.js`, `tests/accept/m22-sell.spec.js` | partial: missions and arcs pay ₡ | GAP-10-005, GAP-10-014, GAP-10-032 |
| M22-4 | **The bank:** ₡ the player holds is cash; a bank account holds the rest and is not lost when wasted or busted (M13-1 and M11-14 take only cash); the player pays in or draws out at a bank's counter, an ATM or the phone's bank app | `tests/accept/m22-bank.spec.js` | red: one ₡ figure | GAP-10-006, GAP-10-016 |
| M22-5 | **Businesses that grow:** a bought building (M11-4) can be upgraded with equipment and staff that raise its output by a stated share, A/B; nine business kinds have their own work (a club, a car wash, a taxi firm, a cinema, a garage, a bar, a shop, a warehouse, a print shop); an owned flat gives a small bonus (a stash, a bed that heals, a garage, a view) | `tests/m22-business.test.js`, `tests/accept/m22-business.spec.js` | partial: an owned building pays its share (M11-4) | GAP-10-009, GAP-10-010, GAP-10-028 |
| M22-6 | **The stock market:** two exchanges on the phone list every firm the seed made, with prices from their profits in the sim; the player's acts move them: a blackout of a firm's district, a hack on its site, a killing of its rival's head (M24's assassination jobs) each move the price by a stated amount; the player buys and sells shares. The city also gets a central bank and an exchange building that raise office demand | `tests/m22-stocks.test.js`, `tests/accept/m22-stocks.spec.js` | red: firms move between districts (`sim/economy.js`), no shares | GAP-10-004 |
| M22-7 | **Gambling:** a casino on a parcel from the seed with blackjack, roulette, poker and slots, played with the mouse, with honest odds stated in `ECONOMY.md`; a betting shop takes bets on horse races shown on its screens; slot machines stand in bars and shops too | `tests/m22-odds.test.js`, `tests/accept/m22-casino.spec.js` | red | GAP-10-007, GAP-10-029, GAP-12-006, GAP-12-076 |
| M22-8 | **The movement:** a self-help movement's centre on a parcel from the seed takes donations, ranks the player up as they give, sells its robes, and gives a chain of missions (M24) | `tests/accept/m22-movement.spec.js` | red | GAP-10-013 |
| M22-9 | **Firms:** every firm has profit and loss from what it buys (goods, M14-14), sells, pays in wages and rent (M15-15); a firm losing money for 3 game days closes and its lot declines; shops buy goods and hire staff from residents by education (M15-10); factories buy inputs and go bankrupt without them. Each household has its own wealth, which sets what it buys and where it can live. A/B: a district cut off from goods loses at least half its shops in 5 game days | `tests/m22-firms.test.js` | partial: firms and wealth by district (`sim/economy.js`), not by firm or household | GAP-10-008, GAP-10-017, GAP-10-024, GAP-10-031, GAP-10-034 |
| M22-10 | **Prices and revenue:** goods have prices that rise when supply falls and fall when it rises, shown in the trade panel (M16-4); office and industry taxes and the goods chain feed the budget's income; the city sets fees for its services and a park's ticket price, and visitors and users change with them, A/B; hotels earn by the attractions near them (M14-20) | `tests/m22-prices.test.js` | partial: the district economy models jobs, homes, firms and wealth | GAP-10-003, GAP-10-023, GAP-10-026, GAP-10-030, GAP-10-033 |
| M22-11 | **Fishing and oil:** fishing grounds on the river or coast from the seed; fishing boats (M16-10) catch, fish farms raise, a processing plant makes fish products sold at a fish market; dolphin-safe and sustainable fishing policies (M14-18) trade yield for happiness, A/B; offshore oil rigs on a coast pump oil into M14-15's chain | `tests/m22-fishing.test.js` | red | GAP-10-018, GAP-10-019, GAP-10-020, GAP-10-021, GAP-10-022, GAP-10-025, GAP-10-027 |
| M22-12 | A saved game keeps cash, the account, shares, business upgrades, vendors' stock and every firm's books, and continues the same | `tests/accept/m22-save.spec.js` | red | — |
| M22-13 | The sweep of every shop, counter, the casino, the bank and the businesses, day and night, has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M22.T1 | **Checks, red: the street's money.** `m22-shops.spec.js`, `m22-vendors.test.js`, `m22-earn.test.js`, `m22-sell.spec.js`, `m22-bank.spec.js`, `m22-business.test.js`, `m22-business.spec.js` | new `tests/accept/m22-shops.spec.js`, new `tests/m22-vendors.test.js`, new `tests/m22-earn.test.js`, new `tests/accept/m22-sell.spec.js`, new `tests/accept/m22-bank.spec.js`, new `tests/m22-business.test.js`, new `tests/accept/m22-business.spec.js` | M11.T15 | M22-1 to M22-5 red | S |
| M22.T2 | **Shops, sim.** `shops.json` (stock by shop kind); buying; food's healing; vending machines from the dressing | new `src/sim/shops.js`, new `src/content/shops.json`, `src/sim/dressing.js` | M22.T1, M13.T49 | M22-1 (part) | M |
| M22.T3 | **The shop menu.** Counter, kiosk and machine menus; the item and price; Esc leaves | new `src/ui/shop.js`, `src/render/interior.js` | M22.T2, M33.T3 | M22-1 | M |
| M22.T4 | **Vendors' stock.** Level, restock and standing in the price | `src/sim/shops.js` | M22.T2, M23.T4 | M22-2 | S |
| M22.T5 | **Earning and selling.** Optional-goal bonuses; caches; selling by vendor kind; fences and the black market; drop points | `src/sim/shops.js`, `src/sim/gigs.js`, `src/sim/mission.js`, `src/sim/hackables.js` | M22.T2 | M22-3 | M |
| M22.T6 | **The bank.** Cash and account; counters, ATMs and the phone app; what wasted and busted take | new `src/sim/bank.js`, `src/sim/respawn.js`, `src/ui/phone.js` | M22.T1, M27.T2 | M22-4 | M |
| M22.T7 | **Businesses.** Upgrades, staff, nine kinds and their work, flats' bonuses | `src/sim/property.js`, new `src/content/businesses.json`, `src/sim/economy.js` | M22.T1, M11.T7 | M22-5 | M |
| M22.T8 | **Checks, red: the city's money.** `m22-stocks.test.js`, `m22-stocks.spec.js`, `m22-odds.test.js`, `m22-casino.spec.js`, `m22-movement.spec.js`, `m22-firms.test.js`, `m22-prices.test.js`, `m22-fishing.test.js`, `m22-save.spec.js` | new `tests/m22-stocks.test.js`, new `tests/accept/m22-stocks.spec.js`, new `tests/m22-odds.test.js`, new `tests/accept/m22-casino.spec.js`, new `tests/accept/m22-movement.spec.js`, new `tests/m22-firms.test.js`, new `tests/m22-prices.test.js`, new `tests/m22-fishing.test.js`, new `tests/accept/m22-save.spec.js` | M22.T1 | M22-6 to M22-12 red | S |
| M22.T9 | **Firms' books.** Profit and loss per firm; closures; buying, hiring by education; factories' inputs and bankruptcy; household wealth | `src/sim/economy.js`, new `src/sim/firms.js`, `src/sim/people.js`, `src/sim/goods.js` | M22.T8, M15.T14 | M22-9 | M |
| M22.T10 | **Prices and revenue.** Supply-and-demand prices; office and industry tax; service fees and park tickets; hotels by attractions | `src/sim/goods.js`, `src/sim/budget.js`, `src/sim/tourism.js`, `src/sim/areas.js` | M22.T9 | M22-10 | M |
| M22.T11 | **The stock market.** Exchanges from the seed's firms; prices from profits and the player's acts; buying and selling on the phone; the central bank and exchange buildings | new `src/sim/stocks.js`, `src/sim/firms.js`, `src/ui/phone.js` | M22.T9 | M22-6 | M |
| M22.T12 | **Gambling.** The casino's four games and their odds; the betting shop's races | new `src/sim/casino.js`, new `src/ui/casino.js`, `src/sim/interior.js` | M22.T8, M33.T3 | M22-7 | M |
| M22.T13 | **The movement.** The centre, donations and ranks, robes, its mission chain | `src/sim/shops.js`, `src/sim/mission.js`, `src/sim/citygen.js` | M22.T8, M24.T2 | M22-8 | S |
| M22.T14 | **Fishing and oil.** Grounds, catch, farms, processing, the market, the two policies, offshore rigs | new `src/sim/fishing.js`, `src/sim/goods.js`, `src/sim/industry.js`, `src/sim/policies.js` | M22.T9, M16.T15 | M22-11 | M |
| M22.T15 | **Save** keeps everything in M22-12 | `src/sim/save.js` | M22.T14 | M22-12 | M |
| M22.T16 | **Close.** The sweep of every money place; one commit per defect | the sweep, `content/hints.json` | all of the above | M22-13 | M |

## Decisions for the operator

None beyond M13's age rating, which also covers M22-7's gambling.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M22-1 | GTA-07-075, CP-13-009 |
| M22-3 | CP-11-012, CP-11-016, CP-11-019, CP-16-016 |
| M22-6 | GTA-11-009 to GTA-11-012, GTA-13-019 |
| M22-11 | GTA-07-013 |
