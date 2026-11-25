# Reel Room

Four original **play-money** slot games: no real money, no purchases, and coins have no cash value.

| Game | Mechanic |
|---|---|
| **Wrapped Riches** | Egyptian 5×3, 20 lines. Scarab collects coins; 3 pyramids start **Mummy Walk** — a mummy roams a 6×5 tomb eating coins, growing 1×1 → 4×4 with diamonds |
| **Sugar Storm** | 6×5 scatter pays (8+ anywhere), tumbles, and multiplier bombs in free spins |
| **Prism Pop** | 10 lines both ways, expanding star wilds with respins; 3 prisms start **Crystal Picks** (match 3 jackpots) |
| **Thunder Vault** | Hold & Spin with MINI / MINOR / MAJOR / GRAND jackpots |

### Table games

| Table | Rules |
|---|---|
| **Blackjack** | 6 decks, dealer stands on all 17s, 3:2 blackjack, double any two, split to 4 hands |
| **Ultimate Texas Hold'em** | Ante + Blind, 4×/3× preflop, 2× flop, 1× river; Trips side bet |
| **Roulette** | European single zero; straight up, dozens, columns, even-money bets |
| **Craps** | Pass/Don't Pass, 3-4-5× odds, Come, Place, Field, Hardways, Any 7, Any Craps, Yo |

## Architecture

- **Frontend:** static HTML/CSS/JS (no build step), served by GitHub Pages
- **Supabase**
  - `profiles`: balance and stats. Clients can read but not write it (RLS)
  - `spins`: spin history (each user can read their own)
  - Edge function `spin`: runs the game math **server-side** (`supabase/functions/spin/engine.js`) and settles the balance atomically through the `settle_spin()` RPC, which only the service role can call. The client only animates the result
  - Edge function `signup`: username + password accounts, no email needed
  - Bonus buy: `{ buy: true }` on `spin` charges `BUY_PRICE[game] × bet` and returns a guaranteed feature (rejection-sampled, so it matches a natural trigger). Prices from `sim/buy.mjs`
  - Edge function `table`: deals and rolls server-side (`supabase/functions/table/tables.js`). Each hand's state, including the shoe and hidden cards, lives in `table_sessions` and is never sent to the browser. `table_commit()` checks the session version, moves coins, logs and saves in one transaction
  - RPC `claim_bonus()`: +5,000 free coins every 4 hours
  - RPC `admin_add_coins(username, amount)`: admins only (`profiles.is_admin`), logged in `coin_grants`

## Math

```
node sim/sim.mjs 1000000      # RTP / hit rate / feature frequency
node sim/breakdown.mjs 200000 # RTP by feature
node sim/tables.mjs 300000    # table game house edges
node sim/table-tests.mjs      # exact payout tests for every table
```

Simulated over 1M spins: every game lands at roughly 94–96% RTP. Max win is 5,000× the bet.
